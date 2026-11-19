/**
 * Storage of the entitlement snapshots: `WorkspaceEntitlement` (one per workspace) and the instance default in
 * `InstanceSetting` (`entitlements.default`). Only the control plane writes them (instance API); the app reads them for
 * its guards. See docs/ENTITLEMENTS.md.
 */
import { Prisma } from '@generated/prisma/client';
import prisma from '../../prisma/prisma';
import type { Db } from '@lib/db/tx';
import { entitlementsMode } from '@lib/instance/config';
import { effectiveSnapshot, SnapshotWireSchema, type EffectiveSnapshot, type SnapshotWire } from './snapshot';

export const DEFAULT_SNAPSHOT_SETTING = 'entitlements.default';

/** Value of the `entitlements.default` setting (actor and reason are in `InstanceAuditLog`). */
export interface StoredDefault {
  snapshot: SnapshotWire;
}

let warnedInvalidStoredSnapshot = false;

/** Stored JSON → snapshot. Rows are validated on write; an unreadable row counts as missing and is logged once. */
function readSnapshot(value: Prisma.JsonValue | undefined | null): SnapshotWire | null {
  if (value === undefined || value === null) return null;
  const parsed = SnapshotWireSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  if (!warnedInvalidStoredSnapshot) {
    warnedInvalidStoredSnapshot = true;
    console.error('[entitlements] A stored entitlement snapshot is invalid and is ignored until the control plane pushes a new one.');
  }
  return null;
}

export async function loadDefaultSnapshot(db: Db = prisma): Promise<SnapshotWire | null> {
  const row = await db.instanceSetting.findUnique({ where: { key: DEFAULT_SNAPSHOT_SETTING } });
  const value = row?.value as { snapshot?: Prisma.JsonValue } | null | undefined;
  return readSnapshot(value?.snapshot);
}

export async function loadWorkspaceSnapshot(workspaceId: string, db: Db = prisma): Promise<SnapshotWire | null> {
  const row = await db.workspaceEntitlement.findUnique({ where: { workspaceId }, select: { snapshot: true } });
  return readSnapshot(row?.snapshot);
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
