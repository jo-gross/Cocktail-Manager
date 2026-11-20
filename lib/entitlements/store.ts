/**
 * Storage of the entitlement snapshots: `WorkspaceEntitlement` (one per workspace) and the instance default in
 * `InstanceSetting` (`entitlements.default`). Only the control plane writes them (instance API); the app reads them for
 * its guards. See docs/ENTITLEMENTS.md.
 */
import { Prisma } from '@generated/prisma/client';
import prisma from '../../prisma/prisma';
import type { Db } from '@lib/db/tx';
import { entitlementsMode } from '@lib/instance/config';
import { effectiveSnapshot, readStoredSnapshot, type EffectiveSnapshot, type SnapshotWire, type StoredSnapshot } from './snapshot';

export const DEFAULT_SNAPSHOT_SETTING = 'entitlements.default';

/** Value of the `entitlements.default` setting (actor and reason are in `InstanceAuditLog`). */
export interface StoredDefault {
  snapshot: SnapshotWire;
}

let warnedInvalidStoredSnapshot = false;

/**
 * Stored JSON → snapshot, read leniently (`readStoredSnapshot`): valid fields are kept, unreadable ones count as
 * unrestricted. Logged once per process, with the field names only.
 */
function readSnapshot(value: Prisma.JsonValue | undefined | null, columns?: { version: number; hash: string }): StoredSnapshot | null {
  if (value === undefined || value === null) return null;
  const stored = readStoredSnapshot(value, columns);
  if ((!stored || stored.invalidFields.length > 0) && !warnedInvalidStoredSnapshot) {
    warnedInvalidStoredSnapshot = true;
    const fields = stored ? stored.invalidFields.join(', ') : 'all';
    console.error(
      `[entitlements] A stored entitlement snapshot has invalid fields (${fields}); they count as unrestricted until the control plane pushes a new snapshot.`,
    );
  }
  return stored;
}

export async function loadStoredDefault(db: Db = prisma): Promise<StoredSnapshot | null> {
  const row = await db.instanceSetting.findUnique({ where: { key: DEFAULT_SNAPSHOT_SETTING } });
  const value = row?.value as { snapshot?: Prisma.JsonValue } | null | undefined;
  return readSnapshot(value?.snapshot);
}

export async function loadDefaultSnapshot(db: Db = prisma): Promise<SnapshotWire | null> {
  return (await loadStoredDefault(db))?.snapshot ?? null;
}

/** Stored snapshot of a workspace; `version` and `hash` come from their columns. */
export function readWorkspaceSnapshot(row: { version: number; hash: string; snapshot: Prisma.JsonValue }): StoredSnapshot {
  // A row always yields a snapshot: even an unreadable one must not fall back to the instance default.
  return readSnapshot(row.snapshot, { version: row.version, hash: row.hash }) ?? readStoredSnapshot({}, { version: row.version, hash: row.hash })!;
}

export async function loadWorkspaceSnapshot(workspaceId: string, db: Db = prisma): Promise<SnapshotWire | null> {
  const row = await db.workspaceEntitlement.findUnique({ where: { workspaceId }, select: { version: true, hash: true, snapshot: true } });
  return row ? readWorkspaceSnapshot(row).snapshot : null;
}

/**
 * The snapshot that applies to the workspace (its own, otherwise the instance default). With `ENTITLEMENTS_MODE=off`
 * this returns `null` without touching the database, so self-hosted instances run exactly as before.
 */
export async function loadEffectiveSnapshot(workspaceId: string, db: Db = prisma): Promise<EffectiveSnapshot | null> {
  const mode = entitlementsMode();
  if (mode !== 'managed') return null;
  // Sequential: `db` may be a transaction client.
  const workspace = await loadWorkspaceSnapshot(workspaceId, db);
  const instanceDefault = workspace ? null : await loadDefaultSnapshot(db);
  return effectiveSnapshot(mode, workspace, instanceDefault);
}
