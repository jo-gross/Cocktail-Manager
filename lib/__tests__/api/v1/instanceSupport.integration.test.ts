/**
 * Support writes of the instance API (capability `support.write`, master key only): ownership transfer, session
 * revocation and workspace deletion, each with audit entry and `Idempotency-Key`.
 */
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import prisma from '../../../../prisma/prisma';
import { workspacesItemHandler } from '@lib/api/v1/instance';
import { transferOwnershipHandler, userSessionsHandler } from '@lib/api/v1/instanceSupport';
import { collectionHandler as announcementsHandler } from '@lib/api/v1/announcements';
import { InstanceWorkspaceDeleteResultSchema } from '@lib/schemas/instance';
import { InstanceRevokeSessionsResultSchema, InstanceTransferOwnershipResultSchema } from '@lib/schemas/instanceSupport';
import { bearerToken, sessionCookie } from '@test/helpers/authFixtures';
import { findUserByRole, seedApiKey, seedCocktail, seedGlass, seedWorkspace, type SeededWorkspace } from '@test/helpers/dbFixtures';
import { callAs, dataOf, errorCodeOf } from '@test/helpers/scenario';

type Headers = Record<string, string>;

const transfer = (id: string, body: unknown, headers: Headers = {}) =>
  callAs('master', transferOwnershipHandler, { method: 'POST', query: { id }, body, headers });
const revoke = (id: string, headers: Headers = {}) => callAs('master', userSessionsHandler, { method: 'DELETE', query: { id }, headers });
const remove = (id: string, headers: Headers = {}) => callAs('master', workspacesItemHandler, { method: 'DELETE', query: { id }, headers });

async function rolesOf(seeded: SeededWorkspace): Promise<Record<string, string>> {
  const members = await prisma.workspaceUser.findMany({ where: { workspaceId: seeded.workspace.id } });
  return Object.fromEntries(members.map((member) => [member.userId, member.role]));
}

const auditHeaders = { 'x-cm-actor': 'admin@example.test', 'x-cm-reason': 'Ticket 4711' };

describe('POST /api/v1/instance/workspaces/{id}/transfer-ownership', () => {
  it('makes the member the only owner and the former owner an admin', async () => {
    const seeded = await seedWorkspace({ users: [{ role: 'OWNER' }, { role: 'USER' }, { role: 'MANAGER' }] });
    const owner = findUserByRole(seeded, 'OWNER').user;
    const user = findUserByRole(seeded, 'USER').user;
    const manager = findUserByRole(seeded, 'MANAGER').user;

    const result = await transfer(seeded.workspace.id, { userId: user.id }, auditHeaders);
    expect(result.status, JSON.stringify(result.json)).toBe(200);
    expect(InstanceTransferOwnershipResultSchema.strict().parse(dataOf(result))).toEqual({ ownerId: user.id });
    expect(await rolesOf(seeded)).toEqual({ [owner.id]: 'ADMIN', [user.id]: 'OWNER', [manager.id]: 'MANAGER' });
  });

  it('demotes every other owner and is a no-op for the only owner', async () => {
    const seeded = await seedWorkspace({ users: [{ role: 'OWNER' }, { role: 'ADMIN' }] });
    const owner = findUserByRole(seeded, 'OWNER').user;
    const admin = findUserByRole(seeded, 'ADMIN').user;
    const second = await prisma.user.create({ data: { name: 'Second Owner', email: `second-${randomUUID()}@test.local`, emailVerified: true } });
    await prisma.workspaceUser.create({ data: { workspaceId: seeded.workspace.id, userId: second.id, role: 'OWNER' } });

    expect((await transfer(seeded.workspace.id, { userId: admin.id })).status).toBe(200);
    expect(await rolesOf(seeded)).toEqual({ [owner.id]: 'ADMIN', [second.id]: 'ADMIN', [admin.id]: 'OWNER' });

    const logged = await prisma.auditLog.count({ where: { workspaceId: seeded.workspace.id } });
    expect((await transfer(seeded.workspace.id, { userId: admin.id })).status).toBe(200);
    expect(await rolesOf(seeded)).toEqual({ [owner.id]: 'ADMIN', [second.id]: 'ADMIN', [admin.id]: 'OWNER' });
    expect(await prisma.auditLog.count({ where: { workspaceId: seeded.workspace.id } })).toBe(logged);
  });

  it('writes the role changes to the workspace audit log and an instance audit entry', async () => {
    const seeded = await seedWorkspace({ users: [{ role: 'OWNER' }, { role: 'USER' }] });
    const owner = findUserByRole(seeded, 'OWNER').user;
    const user = findUserByRole(seeded, 'USER').user;
    await transfer(seeded.workspace.id, { userId: user.id }, auditHeaders);

    const logs = await prisma.auditLog.findMany({ where: { workspaceId: seeded.workspace.id, entityType: 'WorkspaceUser' } });
    expect(logs.map((log) => [log.entityId, log.action]).sort()).toEqual(
      [
        [owner.id, 'UPDATE'],
        [user.id, 'UPDATE'],
      ].sort(),
    );
    for (const log of logs) {
      expect(log.userId).toBeNull();
      const text = JSON.stringify([log.changes, log.snapshot, log.exportData]);
      expect(text).toContain('admin@example.test');
      expect(text).toContain('Ticket 4711');
    }

    const entries = await prisma.instanceAuditLog.findMany();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      action: 'workspace.transferOwnership',
      targetType: 'workspace',
      targetId: seeded.workspace.id,
      actor: 'admin@example.test',
      reason: 'Ticket 4711',
      response: { ownerId: user.id },
      details: { previousRole: 'USER', previousOwnerIds: [owner.id] },
    });
  });

  it('answers 404 for an unknown workspace, an unknown user and a user of another workspace', async () => {
    const seeded = await seedWorkspace({ users: [{ role: 'OWNER' }] });
    const other = await seedWorkspace({ users: [{ role: 'OWNER' }] });
    const owner = findUserByRole(seeded, 'OWNER').user;
    const stranger = findUserByRole(other, 'OWNER').user;

    for (const [name, id, userId] of [
      ['unknown workspace', 'does-not-exist', owner.id],
      ['unknown user', seeded.workspace.id, 'does-not-exist'],
      ['user of another workspace', seeded.workspace.id, stranger.id],
    ]) {
      const result = await transfer(id, { userId });
      expect(result.status, name).toBe(404);
      expect(errorCodeOf(result), name).toBe('NOT_FOUND');
    }
    expect(await rolesOf(seeded)).toEqual({ [owner.id]: 'OWNER' });
    expect(await rolesOf(other)).toEqual({ [stranger.id]: 'OWNER' });
    expect(await prisma.instanceAuditLog.count()).toBe(0);
  });

  it('answers 400 for an invalid body', async () => {
    const seeded = await seedWorkspace({ users: [{ role: 'OWNER' }] });
    for (const body of [{}, { userId: '' }, { userId: 42 }, undefined]) {
      const result = await transfer(seeded.workspace.id, body);
      expect(result.status, JSON.stringify(body)).toBe(400);
      expect(errorCodeOf(result)).toBe('VALIDATION_ERROR');
    }
  });

  it('replays a retry with the same Idempotency-Key and refuses the key for another request', async () => {
    const seeded = await seedWorkspace({ users: [{ role: 'OWNER' }, { role: 'USER' }] });
    const owner = findUserByRole(seeded, 'OWNER').user;
    const user = findUserByRole(seeded, 'USER').user;
    const key = randomUUID();

    expect((await transfer(seeded.workspace.id, { userId: user.id }, { 'idempotency-key': key })).status).toBe(200);
    // Ownership moves back in between: the retry must not transfer it again.
    expect((await transfer(seeded.workspace.id, { userId: owner.id })).status).toBe(200);
    const logged = await prisma.auditLog.count({ where: { workspaceId: seeded.workspace.id } });

    const retry = await transfer(seeded.workspace.id, { userId: user.id }, { 'idempotency-key': key });
    expect(retry.status).toBe(200);
    expect(dataOf(retry)).toEqual({ ownerId: user.id });
    expect(await rolesOf(seeded)).toEqual({ [owner.id]: 'OWNER', [user.id]: 'ADMIN' });
    expect(await prisma.auditLog.count({ where: { workspaceId: seeded.workspace.id } })).toBe(logged);
    expect(await prisma.instanceAuditLog.count()).toBe(2);

    const reused = await transfer(seeded.workspace.id, { userId: owner.id }, { 'idempotency-key': key });
    expect(reused.status).toBe(409);
    expect(errorCodeOf(reused)).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('runs again after a failed attempt with the same key', async () => {
    const seeded = await seedWorkspace({ users: [{ role: 'OWNER' }] });
    const joiner = await prisma.user.create({ data: { name: 'Joiner', email: `joiner-${randomUUID()}@test.local`, emailVerified: true } });
    const key = randomUUID();

    expect((await transfer(seeded.workspace.id, { userId: joiner.id }, { 'idempotency-key': key })).status).toBe(404);
    await prisma.workspaceUser.create({ data: { workspaceId: seeded.workspace.id, userId: joiner.id, role: 'USER' } });
    const retry = await transfer(seeded.workspace.id, { userId: joiner.id }, { 'idempotency-key': key });
    expect(retry.status).toBe(200);
    expect((await rolesOf(seeded))[joiner.id]).toBe('OWNER');
  });
});

describe('DELETE /api/v1/instance/users/{id}/sessions', () => {
  it('deletes every session of the user and counts the ones that had not expired', async () => {
    const seeded = await seedWorkspace({ users: [{ role: 'OWNER' }, { role: 'USER' }] });
    const owner = findUserByRole(seeded, 'OWNER');
    const user = findUserByRole(seeded, 'USER');
    await prisma.session.create({ data: { token: `second-${randomUUID()}`, userId: owner.user.id, expiresAt: new Date(Date.now() + 60_000) } });
    await prisma.session.create({ data: { token: `expired-${randomUUID()}`, userId: owner.user.id, expiresAt: new Date(Date.now() - 60_000) } });
    expect((await callAs(owner, announcementsHandler, { method: 'GET' })).status).toBe(200);

    const result = await revoke(owner.user.id, auditHeaders);
    expect(result.status, JSON.stringify(result.json)).toBe(200);
    expect(InstanceRevokeSessionsResultSchema.strict().parse(dataOf(result))).toEqual({ revoked: 2 });

    expect(await prisma.session.count({ where: { userId: owner.user.id } })).toBe(0);
    expect(await prisma.session.count({ where: { userId: user.user.id } })).toBe(1);
    expect((await callAs(owner, announcementsHandler, { method: 'GET' })).status).toBe(401);
    expect((await callAs(user, announcementsHandler, { method: 'GET' })).status).toBe(200);
    // The account itself stays.
    expect(await prisma.user.count({ where: { id: owner.user.id } })).toBe(1);

    const entries = await prisma.instanceAuditLog.findMany();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      action: 'user.revokeSessions',
      targetType: 'user',
      targetId: owner.user.id,
      actor: 'admin@example.test',
      reason: 'Ticket 4711',
      response: { revoked: 2 },
      details: { deletedSessions: 3 },
    });
    expect(JSON.stringify(entries[0])).not.toContain(owner.sessionToken);
  });

  it('answers 0 for a user without sessions and 404 for an unknown user', async () => {
    const user = await prisma.user.create({ data: { name: 'Idle', email: `idle-${randomUUID()}@test.local`, emailVerified: true } });
    expect(dataOf(await revoke(user.id))).toEqual({ revoked: 0 });

    const unknown = await revoke('does-not-exist');
    expect(unknown.status).toBe(404);
    expect(errorCodeOf(unknown)).toBe('NOT_FOUND');
    expect(await prisma.instanceAuditLog.count()).toBe(1);
  });

  it('replays a retry with the same Idempotency-Key without revoking newer sessions', async () => {
    const seeded = await seedWorkspace({ users: [{ role: 'OWNER' }] });
    const owner = findUserByRole(seeded, 'OWNER');
    const key = randomUUID();
    expect(dataOf(await revoke(owner.user.id, { 'idempotency-key': key }))).toEqual({ revoked: 1 });

    await prisma.session.create({ data: { token: `new-${randomUUID()}`, userId: owner.user.id, expiresAt: new Date(Date.now() + 60_000) } });
    const retry = await revoke(owner.user.id, { 'idempotency-key': key });
    expect(retry.status).toBe(200);
    expect(dataOf(retry)).toEqual({ revoked: 1 });
    expect(await prisma.session.count({ where: { userId: owner.user.id } })).toBe(1);
    expect(await prisma.instanceAuditLog.count()).toBe(1);

    const other = await seedWorkspace({ users: [{ role: 'OWNER' }] });
    const reused = await revoke(findUserByRole(other, 'OWNER').user.id, { 'idempotency-key': key });
    expect(reused.status).toBe(409);
    expect(errorCodeOf(reused)).toBe('IDEMPOTENCY_KEY_REUSED');
    expect(await prisma.session.count({ where: { userId: findUserByRole(other, 'OWNER').user.id } })).toBe(1);
  });
});

describe('DELETE /api/v1/instance/workspaces/{id}', () => {
  it('deletes the workspace with its content and keeps the users and other workspaces', async () => {
    const seeded = await seedWorkspace({ name: 'Staging copy', users: [{ role: 'OWNER' }, { role: 'USER' }] });
    const other = await seedWorkspace({ users: [{ role: 'OWNER' }] });
    const owner = findUserByRole(seeded, 'OWNER').user;
    const glass = await seedGlass(seeded.workspace.id);
    await seedCocktail(seeded.workspace.id, glass.id);
    const otherGlass = await seedGlass(other.workspace.id);

    const result = await remove(seeded.workspace.id, auditHeaders);
    expect(result.status, JSON.stringify(result.json)).toBe(200);
    expect(InstanceWorkspaceDeleteResultSchema.strict().parse(dataOf(result))).toEqual({ deleted: true });

    expect(await prisma.workspace.count({ where: { id: seeded.workspace.id } })).toBe(0);
    expect(await prisma.cocktailRecipe.count({ where: { workspaceId: seeded.workspace.id } })).toBe(0);
    expect(await prisma.glass.count({ where: { workspaceId: seeded.workspace.id } })).toBe(0);
    expect(await prisma.workspaceUser.count({ where: { workspaceId: seeded.workspace.id } })).toBe(0);
    expect(await prisma.user.count({ where: { id: owner.id } })).toBe(1);
    expect(await prisma.workspace.count({ where: { id: other.workspace.id } })).toBe(1);
    expect(await prisma.glass.count({ where: { id: otherGlass.id } })).toBe(1);

    const entries = await prisma.instanceAuditLog.findMany();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      action: 'workspace.delete',
      targetType: 'workspace',
      targetId: seeded.workspace.id,
      actor: 'admin@example.test',
      reason: 'Ticket 4711',
      response: { deleted: true },
      details: { name: 'Staging copy', isDemo: false, memberCount: 2, ownerIds: [owner.id] },
    });
  });

  it('answers 404 for an unknown workspace and for a second delete without a key', async () => {
    const seeded = await seedWorkspace({ users: [{ role: 'OWNER' }] });
    const unknown = await remove('does-not-exist');
    expect(unknown.status).toBe(404);
    expect(errorCodeOf(unknown)).toBe('NOT_FOUND');

    expect((await remove(seeded.workspace.id)).status).toBe(200);
    expect((await remove(seeded.workspace.id)).status).toBe(404);
    expect(await prisma.instanceAuditLog.count()).toBe(1);
  });

  it('replays a retry with the same Idempotency-Key', async () => {
    const seeded = await seedWorkspace({ users: [{ role: 'OWNER' }] });
    const other = await seedWorkspace({ users: [{ role: 'OWNER' }] });
    const key = randomUUID();
    expect((await remove(seeded.workspace.id, { 'idempotency-key': key })).status).toBe(200);

    const retry = await remove(seeded.workspace.id, { 'idempotency-key': key });
    expect(retry.status).toBe(200);
    expect(dataOf(retry)).toEqual({ deleted: true });
    expect(await prisma.instanceAuditLog.count()).toBe(1);

    const reused = await remove(other.workspace.id, { 'idempotency-key': key });
    expect(reused.status).toBe(409);
    expect(errorCodeOf(reused)).toBe('IDEMPOTENCY_KEY_REUSED');
    expect(await prisma.workspace.count({ where: { id: other.workspace.id } })).toBe(1);
  });

  it('refuses a template workspace', async () => {
    const seeded = await seedWorkspace({ users: [{ role: 'OWNER' }] });
    await prisma.workspaceTemplate.create({
      data: { workspaceId: seeded.workspace.id, key: `tpl-${randomUUID()}`, kind: 'BASE', name: { de: 'Vorlage', en: 'Template' }, locales: ['de', 'en'] },
    });
    const result = await remove(seeded.workspace.id);
    expect(result.status).toBe(409);
    expect(errorCodeOf(result)).toBe('TEMPLATE_IN_USE');
    expect(await prisma.workspace.count({ where: { id: seeded.workspace.id } })).toBe(1);
    expect(await prisma.instanceAuditLog.count()).toBe(0);
  });
});

describe('master key only', () => {
  it('answers 401 without the master key and changes nothing', async () => {
    const seeded = await seedWorkspace({ users: [{ role: 'OWNER' }, { role: 'USER' }] });
    const owner = findUserByRole(seeded, 'OWNER');
    const user = findUserByRole(seeded, 'USER');
    const apiKey = await seedApiKey(seeded.workspace.id, owner.user.id, ['WORKSPACE_READ', 'WORKSPACE_UPDATE', 'USERS_UPDATE', 'USERS_DELETE']);
    const sessions = await prisma.session.count();

    const calls = [
      ['transfer', transferOwnershipHandler, 'POST', { id: seeded.workspace.id }, { userId: user.user.id }],
      ['sessions', userSessionsHandler, 'DELETE', { id: user.user.id }, undefined],
      ['delete', workspacesItemHandler, 'DELETE', { id: seeded.workspace.id }, undefined],
    ] as const;
    for (const [name, handler, method, query, body] of calls) {
      for (const [who, headers] of [
        ['no key', {}],
        ['wrong key', bearerToken('ck_master_wrong')],
        ['owner session', sessionCookie(owner.sessionToken)],
        ['workspace api key', bearerToken(apiKey.jwt)],
      ] as const) {
        const result = await callAs('anonymous', handler, { method, query: { ...query }, body, headers: { ...headers } });
        expect(result.status, `${name} with ${who}`).toBe(401);
        expect(errorCodeOf(result), `${name} with ${who}`).toBe('UNAUTHORIZED');
      }
    }

    expect(await rolesOf(seeded)).toEqual({ [owner.user.id]: 'OWNER', [user.user.id]: 'USER' });
    expect(await prisma.session.count()).toBe(sessions);
    expect(await prisma.instanceAuditLog.count()).toBe(0);
  });

  it('refuses invalid control plane headers before changing anything', async () => {
    const seeded = await seedWorkspace({ users: [{ role: 'OWNER' }] });
    const owner = findUserByRole(seeded, 'OWNER');
    const invalid = { 'idempotency-key': 'not-a-uuid' };
    for (const result of [
      await transfer(seeded.workspace.id, { userId: owner.user.id }, invalid),
      await revoke(owner.user.id, invalid),
      await remove(seeded.workspace.id, invalid),
    ]) {
      expect(result.status).toBe(400);
      expect(errorCodeOf(result)).toBe('VALIDATION_ERROR');
    }
    expect(await prisma.workspace.count({ where: { id: seeded.workspace.id } })).toBe(1);
    expect(await prisma.session.count({ where: { userId: owner.user.id } })).toBe(1);
  });
});
