/**
 * Retention of `InstanceAuditLog` (docs/INSTANCE-API.md "Retention"): entries older than 90 days are deleted, and the
 * stored answer of an `Idempotency-Key` is released after 30 days (the key is cleared, the entry stays as audit). Runs
 * opportunistically after a control plane write, at most once per hour per process; self-hosted instances without
 * control plane writes never run it.
 */
import prisma from '../../prisma/prisma';

export const INSTANCE_AUDIT_RETENTION_DAYS = 90;
/** A retry with the same key gets the first answer within this window; the control plane retries open pushes within hours. */
export const IDEMPOTENCY_WINDOW_DAYS = 30;
const RUN_INTERVAL_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

let lastRunAt: number | null = null;

export async function pruneInstanceAuditLog(now: Date = new Date()): Promise<{ deleted: number; keysReleased: number }> {
  const { count: deleted } = await prisma.instanceAuditLog.deleteMany({
    where: { createdAt: { lt: new Date(now.getTime() - INSTANCE_AUDIT_RETENTION_DAYS * DAY_MS) } },
  });
  const { count: keysReleased } = await prisma.instanceAuditLog.updateMany({
    where: { idempotencyKey: { not: null }, createdAt: { lt: new Date(now.getTime() - IDEMPOTENCY_WINDOW_DAYS * DAY_MS) } },
    data: { idempotencyKey: null },
  });
  return { deleted, keysReleased };
}

/** Prunes when the last run of this process is at least an hour ago. Never throws: retention must not fail a write. */
export async function pruneInstanceAuditLogPeriodically(now: number = Date.now()): Promise<void> {
  if (lastRunAt !== null && now - lastRunAt < RUN_INTERVAL_MS) return;
  lastRunAt = now;
  try {
    const { deleted, keysReleased } = await pruneInstanceAuditLog(new Date(now));
    if (deleted > 0 || keysReleased > 0) console.info(`[InstanceAuditLog] Retention: ${deleted} entries deleted, ${keysReleased} idempotency keys released.`);
  } catch (error) {
    console.error('[InstanceAuditLog] Retention failed; the next control plane write after an hour tries again.', error);
  }
}

/** Tests only: the next call of `pruneInstanceAuditLogPeriodically` runs. */
export function resetInstanceAuditRetentionForTests(): void {
  lastRunAt = null;
}
