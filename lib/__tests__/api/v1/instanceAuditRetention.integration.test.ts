/**
 * Retention of `InstanceAuditLog`: entries older than 90 days are deleted and idempotency answers are released after
 * 30 days, opportunistically on the next control plane write and at most once per hour per process.
 */
import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import prisma from '../../../../prisma/prisma';
import { userSessionsHandler } from '@lib/api/v1/instanceSupport';
import { pruneInstanceAuditLogPeriodically, resetInstanceAuditRetentionForTests } from '@lib/instance/auditRetention';
import { findUserByRole, seedWorkspace } from '@test/helpers/dbFixtures';
import { callAs } from '@test/helpers/scenario';

const DAY_MS = 24 * 60 * 60 * 1000;

async function seedEntry(ageDays: number, idempotencyKey: string | null = randomUUID()) {
  return prisma.instanceAuditLog.create({
    data: {
      action: 'user.revokeSessions',
      targetType: 'user',
      targetId: 'u-old',
      idempotencyKey,
      requestHash: 'x'.repeat(64),
      response: { revoked: 0 },
      createdAt: new Date(Date.now() - ageDays * DAY_MS),
    },
  });
}

describe('InstanceAuditLog retention', () => {
  beforeEach(() => resetInstanceAuditRetentionForTests());

  it('deletes entries after 90 days and releases idempotency keys after 30 days on the next control plane write', async () => {
    const expired = await seedEntry(91);
    const keyExpired = await seedEntry(31);
    const recent = await seedEntry(1);
    const seeded = await seedWorkspace({ users: [{ role: 'OWNER' }] });

    const result = await callAs('master', userSessionsHandler, { method: 'DELETE', query: { id: findUserByRole(seeded, 'OWNER').user.id } });
    expect(result.status).toBe(200);

    expect(await prisma.instanceAuditLog.findUnique({ where: { id: expired.id } })).toBeNull();
    expect(await prisma.instanceAuditLog.findUnique({ where: { id: keyExpired.id } })).toMatchObject({ idempotencyKey: null, response: { revoked: 0 } });
    expect(await prisma.instanceAuditLog.findUnique({ where: { id: recent.id } })).toMatchObject({ idempotencyKey: recent.idempotencyKey });
    // The write itself is audited.
    expect(await prisma.instanceAuditLog.count({ where: { action: 'user.revokeSessions', targetId: findUserByRole(seeded, 'OWNER').user.id } })).toBe(1);
  });

  it('runs at most once per hour per process', async () => {
    const now = Date.now();
    await pruneInstanceAuditLogPeriodically(now);
    const expired = await seedEntry(120, null);

    await pruneInstanceAuditLogPeriodically(now + 59 * 60 * 1000);
    expect(await prisma.instanceAuditLog.findUnique({ where: { id: expired.id } })).not.toBeNull();

    await pruneInstanceAuditLogPeriodically(now + 60 * 60 * 1000);
    expect(await prisma.instanceAuditLog.findUnique({ where: { id: expired.id } })).toBeNull();
  });
});
