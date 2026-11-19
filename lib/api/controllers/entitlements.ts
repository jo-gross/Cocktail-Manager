/**
 * Entitlement controllers (docs/ENTITLEMENTS.md):
 * - snapshot pushes of the control plane (instance API, master key only), with the version rule of the contract,
 *   `Idempotency-Key` and the control plane headers in the audit log
 * - the plan of a workspace for its members (plan card, banners, limit dialog).
 */
import type { NextApiRequest } from 'next';
import type { Prisma, Workspace } from '@generated/prisma/client';
import { lockWorkspaceScope } from '@lib/db/tx';
import { ApiError } from '@lib/http/ApiError';
import { entitlementsMode } from '@lib/instance/config';
import { portalHandoffAvailable } from '@lib/portal/handoffConfig';
import type { ControlPlaneHeaders } from '@lib/instance/controlPlaneHeaders';
import { runControlPlaneWrite } from '@lib/instance/controlPlaneWrite';
import { shouldApply, type SnapshotWire } from '@lib/entitlements/snapshot';
import { DEFAULT_SNAPSHOT_SETTING, loadEffectiveSnapshot, type StoredDefault } from '@lib/entitlements/store';
import { countAllUsage } from '@lib/entitlements/usage';
import type { EntitlementApplyResult, WorkspaceEntitlementDto } from '@lib/schemas/entitlements';
import prisma from '../../../prisma/prisma';

/** Lock key of the default snapshot (no workspace; any constant id works). */
const INSTANCE_SCOPE = 'instance';

/** What the workspace audit log keeps of a snapshot, plus who pushed it and why. */
function auditSnapshot(snapshot: SnapshotWire, headers: ControlPlaneHeaders) {
  return {
    version: snapshot.version,
    hash: snapshot.hash,
    planKey: snapshot.planKey,
    status: snapshot.status,
    limits: snapshot.limits,
    features: snapshot.features,
    billing: snapshot.billing,
    nextChangeAt: snapshot.nextChangeAt,
    scheduledEnd: snapshot.scheduledEnd ?? null,
    controlPlane: { actor: headers.actor, reason: headers.reason },
  };
}

/**
 * Default snapshot. Write, `InstanceAuditLog` entry (actor, reason, version) and `Idempotency-Key` go through
 * `runControlPlaneWrite`; the setting holds only the snapshot.
 */
export async function putDefaultEntitlements(req: NextApiRequest, snapshot: SnapshotWire): Promise<EntitlementApplyResult> {
  const result = await runControlPlaneWrite({
    headers: req.headers,
    action: 'entitlements.default',
    target: { type: 'instance', id: null },
    payload: snapshot,
    apply: async (tx) => {
      await lockWorkspaceScope(tx, INSTANCE_SCOPE, 'entitlements:default');
      const row = await tx.instanceSetting.findUnique({ where: { key: DEFAULT_SNAPSHOT_SETTING } });
      const current = (row?.value as unknown as StoredDefault | undefined)?.snapshot ?? null;
      if (!shouldApply(current?.version ?? null, snapshot.version)) {
        const response = { applied: false, currentVersion: current?.version ?? 0, currentHash: current?.hash ?? null };
        return { response, details: { version: snapshot.version, planKey: snapshot.planKey } };
      }
      const json = { snapshot } as unknown as Prisma.InputJsonValue;
      await tx.instanceSetting.upsert({
        where: { key: DEFAULT_SNAPSHOT_SETTING },
        create: { key: DEFAULT_SNAPSHOT_SETTING, value: json },
        update: { value: json },
      });
      const response = { applied: true, currentVersion: snapshot.version, currentHash: snapshot.hash };
      return { response, details: { version: snapshot.version, planKey: snapshot.planKey, status: snapshot.status } };
    },
  });
  if (result.applied) console.info(`[entitlements] Default snapshot version ${snapshot.version} (${snapshot.planKey}) applied.`);
  return result;
}

/**
 * Workspace snapshot. `runControlPlaneWrite` keeps the `InstanceAuditLog` entry and the `Idempotency-Key`; an applied
 * snapshot additionally goes to the audit log of the workspace with actor and reason, like the other control plane
 * changes of workspace content (ownership transfer), so the customer-facing history shows plan changes.
 */
export async function putWorkspaceEntitlements(req: NextApiRequest, workspaceId: string, snapshot: SnapshotWire): Promise<EntitlementApplyResult> {
  return runControlPlaneWrite({
    headers: req.headers,
    action: 'entitlements.workspace',
    target: { type: 'workspace', id: workspaceId },
    payload: snapshot,
    apply: async (tx, headers) => {
      const workspace = await tx.workspace.findUnique({ where: { id: workspaceId }, select: { id: true } });
      if (!workspace) throw new ApiError(404, 'NOT_FOUND', 'Workspace not found');
      await lockWorkspaceScope(tx, workspaceId, 'entitlements:snapshot');

      const current = await tx.workspaceEntitlement.findUnique({ where: { workspaceId }, select: { version: true, hash: true, snapshot: true } });
      if (!shouldApply(current?.version ?? null, snapshot.version)) {
        const response = { applied: false, currentVersion: current?.version ?? 0, currentHash: current?.hash ?? null };
        return { response, details: { version: snapshot.version, planKey: snapshot.planKey } };
      }

      const json = snapshot as unknown as Prisma.InputJsonValue;
      const data = { version: snapshot.version, hash: snapshot.hash, snapshot: json, appliedAt: new Date() };
      await tx.workspaceEntitlement.upsert({ where: { workspaceId }, create: { workspaceId, ...data }, update: data });
      const previous = current?.snapshot as unknown as SnapshotWire | undefined;
      await tx.auditLog.create({
        data: {
          workspaceId,
          userId: null,
          entityType: 'WorkspaceEntitlement',
          entityId: workspaceId,
          action: current ? 'UPDATE' : 'CREATE',
          changes: previous
            ? ({ from: { version: previous.version, planKey: previous.planKey, status: previous.status } } as Prisma.InputJsonValue)
            : undefined,
          snapshot: auditSnapshot(snapshot, headers) as unknown as Prisma.InputJsonValue,
        },
      });
      const response = { applied: true, currentVersion: snapshot.version, currentHash: snapshot.hash };
      return { response, details: { version: snapshot.version, planKey: snapshot.planKey, status: snapshot.status } };
    },
  });
}

/** Plan of the workspace for the UI. With `ENTITLEMENTS_MODE=off` it answers without touching the database. */
export async function getWorkspaceEntitlement(workspace: Workspace): Promise<WorkspaceEntitlementDto> {
  const mode = entitlementsMode();
  if (mode !== 'managed') return { mode, plan: null, usage: null, portalHandoff: false };
  const [effective, usage] = await Promise.all([loadEffectiveSnapshot(workspace.id), countAllUsage(prisma, workspace.id)]);
  const portalHandoff = portalHandoffAvailable();
  if (!effective) return { mode, plan: null, usage, portalHandoff };
  const { snapshot, source } = effective;
  return {
    mode,
    plan: {
      planKey: snapshot.planKey,
      planName: snapshot.planName,
      status: snapshot.status,
      billing: snapshot.billing,
      nextChangeAt: snapshot.nextChangeAt,
      scheduledEnd: snapshot.scheduledEnd ?? null,
      limits: snapshot.limits,
      features: snapshot.features,
      source,
    },
    usage,
    portalHandoff,
  };
}
