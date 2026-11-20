/**
 * Entitlement guards for the write paths (docs/ENTITLEMENTS.md "Guards"). Every guard is a no-op without a
 * snapshot, i.e. always with `ENTITLEMENTS_MODE=off` (no database access) and in `managed` mode before the first push.
 *
 * Races: limit guards run inside the transaction of the write. They take a transaction-scoped advisory lock per
 * workspace and limit key before counting, so concurrent writes of the same key are serialized and cannot overshoot.
 * Take the guard first in a transaction (before other workspace locks), so the lock order stays the same everywhere.
 */
import type { NextApiRequest } from 'next';
import prisma from '../../prisma/prisma';
import { lockWorkspaceScope, type Db, type Tx } from '@lib/db/tx';
import type { ApiError } from '@lib/http/ApiError';
import { entitlementsMode } from '@lib/instance/config';
import { planFeatureMissing, planLimitReached, workspaceStatusBlocked } from './errors';
import {
  FREE_WORKSPACES_KEY,
  LIMIT_KEYS,
  decideLimit,
  decideStatus,
  hasFeature,
  isFreeWorkspace,
  limitOf,
  parseFreeWorkspacesPerOwner,
  type FeatureKey,
  type LimitKey,
} from './snapshot';
import { statusExemptionsOf } from './statusGate';
import { loadDefaultSnapshot, loadEffectiveSnapshot, readWorkspaceSnapshot } from './store';
import { countUsage } from './usage';

const lockScope = (key: string) => `entitlements:${key}`;

/** Refuses a write that adds `adding` items of `key` when the limit would be exceeded (402 `PLAN_LIMIT_REACHED`). */
export async function assertWithinLimit(tx: Tx, workspaceId: string, key: LimitKey, adding = 1): Promise<void> {
  const limit = limitOf(await loadEffectiveSnapshot(workspaceId, tx), key);
  if (limit === null) return;
  await lockWorkspaceScope(tx, workspaceId, lockScope(key));
  const current = await countUsage(tx, workspaceId, key);
  const decision = decideLimit(limit, current, current + adding);
  if (!decision.allowed) throw planLimitReached(key, decision.limit, decision.current);
}

/**
 * Fast refusal before an expensive import transaction: `adds` items per key on top of the current usage. Not locked;
 * the import transaction still runs `trackLimits`, which is authoritative.
 */
export async function assertImportFits(workspaceId: string, adds: Partial<Record<LimitKey, number>>): Promise<void> {
  const effective = await loadEffectiveSnapshot(workspaceId);
  for (const key of LIMIT_KEYS) {
    const limit = limitOf(effective, key);
    const adding = adds[key] ?? 0;
    if (limit === null || adding === 0) continue;
    const current = await countUsage(prisma, workspaceId, key);
    const decision = decideLimit(limit, current, current + adding);
    if (!decision.allowed) throw planLimitReached(key, decision.limit, decision.current);
  }
}

/** Limits a backup or template import can raise. */
export const IMPORT_LIMIT_KEYS: readonly LimitKey[] = ['cocktails', 'calculations', 'guestMenusPublished', 'signageScreens'];

export interface LimitTracker {
  /** Counts again and throws 402 when a write raised a count above its limit; the transaction then rolls back. */
  check(): Promise<void>;
}

/**
 * For writes whose effect on the counts is only known after writing (imports, template apply, unarchive, signage):
 * locks and counts the limited keys before, `check()` compares after the writes in the same transaction.
 */
export async function trackLimits(tx: Tx, workspaceId: string, keys: readonly LimitKey[]): Promise<LimitTracker> {
  const effective = await loadEffectiveSnapshot(workspaceId, tx);
  const tracked: Array<{ key: LimitKey; limit: number; before: number }> = [];
  // Canonical key order keeps the lock order stable between guards.
  for (const key of LIMIT_KEYS) {
    if (!keys.includes(key)) continue;
    const limit = limitOf(effective, key);
    if (limit === null) continue;
    await lockWorkspaceScope(tx, workspaceId, lockScope(key));
    tracked.push({ key, limit, before: await countUsage(tx, workspaceId, key) });
  }
  return {
    async check() {
      for (const { key, limit, before } of tracked) {
        const decision = decideLimit(limit, before, await countUsage(tx, workspaceId, key));
        if (!decision.allowed) throw planLimitReached(key, decision.limit, decision.current);
      }
    },
  };
}

/** Refuses a feature the plan does not include (402 `PLAN_FEATURE_MISSING`). */
export async function assertFeature(workspaceId: string, feature: FeatureKey, db: Db = prisma): Promise<void> {
  if (!hasFeature(await loadEffectiveSnapshot(workspaceId, db), feature)) throw planFeatureMissing(feature);
}

/** `false` when the plan lacks the feature; for rendering decisions (branding, public signage) instead of errors. */
export async function workspaceHasFeature(workspaceId: string, feature: FeatureKey, db: Db = prisma): Promise<boolean> {
  return hasFeature(await loadEffectiveSnapshot(workspaceId, db), feature);
}

/**
 * Public pages (guest menus, signage feed) of a suspended workspace show a neutral "currently not available" state.
 * `READ_ONLY` keeps them working. Always `false` with `ENTITLEMENTS_MODE=off`.
 */
export async function isWorkspaceSuspended(workspaceId: string, db: Db = prisma): Promise<boolean> {
  return (await loadEffectiveSnapshot(workspaceId, db))?.snapshot.status === 'SUSPENDED';
}

/**
 * Central check of `withWorkspacePermission`/`withWorkspaceSession` after authentication: the workspace status
 * (`READ_ONLY`, `SUSPENDED`) and, for workspace API keys, the `api` feature. Existing keys stay stored but are refused
 * while the plan lacks `api`. The instance master key is not checked (operator access of the control plane).
 */
export async function workspaceAccessError(req: NextApiRequest, workspaceId: string, via: 'session' | 'apiKey'): Promise<ApiError | null> {
  const effective = await loadEffectiveSnapshot(workspaceId);
  if (!effective) return null;
  if (via === 'apiKey' && !hasFeature(effective, 'api')) return planFeatureMissing('api');
  const decision = decideStatus(effective.snapshot.status, req.method, statusExemptionsOf(req));
  return decision.allowed ? null : workspaceStatusBlocked(decision);
}

/**
 * `freeWorkspacesPerOwner` when a user creates a workspace in the app: the number of workspaces the user owns that run
 * on the default plan. Applies only in `managed` mode, after a default was pushed and with
 * `ENTITLEMENTS_FREE_WORKSPACES_PER_OWNER` set. Serialized per user, so parallel creations cannot overshoot.
 */
export async function assertFreeWorkspaceAvailable(tx: Tx, userId: string): Promise<void> {
  if (entitlementsMode() !== 'managed') return;
  const limit = parseFreeWorkspacesPerOwner(process.env.ENTITLEMENTS_FREE_WORKSPACES_PER_OWNER);
  if (limit === null) return;
  const instanceDefault = await loadDefaultSnapshot(tx);
  if (!instanceDefault) return;

  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockScope(FREE_WORKSPACES_KEY)}), hashtext(${userId}))`;
  const owned = await tx.workspaceUser.findMany({
    where: { userId, role: 'OWNER', workspace: { isDemo: false, template: { is: null } } },
    select: { workspace: { select: { entitlement: { select: { version: true, hash: true, snapshot: true } } } } },
  });
  // An own snapshot with an unreadable plan key does not count as free (it is no longer known to be the default plan).
  const free = owned.filter(({ workspace }) =>
    isFreeWorkspace(workspace.entitlement ? readWorkspaceSnapshot(workspace.entitlement).snapshot.planKey : null, instanceDefault.planKey),
  ).length;
  const decision = decideLimit(limit, free, free + 1);
  if (!decision.allowed) throw planLimitReached(FREE_WORKSPACES_KEY, decision.limit, decision.current);
}
