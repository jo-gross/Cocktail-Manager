import { describe, it, expect } from 'vitest';
import prisma from '../../../../prisma/prisma';
import { collectionHandler as usersCollectionHandler } from '@lib/api/v1/workspaceUsers';
import { collectionHandler as joinCodesHandler } from '@lib/api/v1/joinCodes';
import { collectionHandler as apiKeysHandler, itemHandler as apiKeyItemHandler } from '@lib/api/v1/apiKeys';
import { collectionHandler as glassesHandler } from '@lib/api/v1/glasses';
import { collectionHandler as auditLogsHandler } from '@lib/api/v1/auditLogs';
import { itemHandler as workspaceHandler, settingsHandler } from '@lib/api/v1/workspace';
import { userSettingsHandler } from '@lib/api/v1/userSettings';
import workspacesHandler from '../../../../pages/api/v1/workspaces/index';
import usersHandler from '../../../../pages/api/users/index';
import workspaceRequestsHandler from '../../../../pages/api/users/workspace-requests';
import { createApiKeyJwt } from '@middleware/api/jwtApiKeyMiddleware';
import { invokeHandler } from '@test/helpers/invokeHandler';
import { sessionCookie } from '@test/helpers/authFixtures';
import { findUserByRole, seedApiKey, seedWorkspace } from '@test/helpers/dbFixtures';
import { callAs, dataOf, errorCodeOf, roleUser, seedTenantPair } from '@test/helpers/scenario';
import { seedSessionUser } from '@test/helpers/fixtures/g6';

describe('workspace admin v1 integration', () => {
  async function setup() {
    return seedWorkspace({
      users: [{ role: 'USER' }, { role: 'ADMIN' }],
    });
  }

  describe('workspace users', () => {
    it('lists workspace members for USER', async () => {
      const seeded = await setup();
      const user = findUserByRole(seeded, 'USER');
      const result = await invokeHandler(usersCollectionHandler, {
        method: 'GET',
        query: { workspaceId: seeded.workspace.id },
        headers: sessionCookie(user.sessionToken),
      });
      expect(result.status).toBe(200);
      expect((result.json as { data: unknown[] }).data.length).toBeGreaterThanOrEqual(2);
    });

    it('returns 401 without auth', async () => {
      const seeded = await setup();
      const result = await invokeHandler(usersCollectionHandler, {
        method: 'GET',
        query: { workspaceId: seeded.workspace.id },
      });
      expect(result.status).toBe(401);
    });
  });

  describe('join codes', () => {
    it('returns 403 for USER creating join codes', async () => {
      const seeded = await setup();
      const user = findUserByRole(seeded, 'USER');
      const result = await invokeHandler(joinCodesHandler, {
        method: 'POST',
        query: { workspaceId: seeded.workspace.id },
        body: { code: 'join-test-01' },
        headers: sessionCookie(user.sessionToken),
      });
      expect(result.status).toBe(403);
    });

    it('allows MANAGER to create join codes', async () => {
      const seeded = await seedWorkspace({
        users: [{ role: 'MANAGER' }, { role: 'ADMIN' }],
      });
      const manager = findUserByRole(seeded, 'MANAGER');
      const result = await invokeHandler(joinCodesHandler, {
        method: 'POST',
        query: { workspaceId: seeded.workspace.id },
        body: { code: 'join-test-01' },
        headers: sessionCookie(manager.sessionToken),
      });
      expect(result.status).toBe(200);
      expect((result.json as { data: { code: string } }).data.code).toBe('join-test-01');
    });
  });

  describe('api keys (sessionOnly)', () => {
    it('returns 401 when creating API key with API key instead of session', async () => {
      const seeded = await setup();
      const admin = findUserByRole(seeded, 'ADMIN');
      const apiKey = await seedApiKey(seeded.workspace.id, admin.user.id, ['WORKSPACE_READ']);

      const result = await invokeHandler(apiKeysHandler, {
        method: 'POST',
        query: { workspaceId: seeded.workspace.id },
        body: { name: 'Another Key' },
        headers: { authorization: `Bearer ${apiKey.jwt}` },
      });
      expect(result.status).toBe(401);
    });

    it('lists API keys for ADMIN session', async () => {
      const seeded = await setup();
      const admin = findUserByRole(seeded, 'ADMIN');
      const result = await invokeHandler(apiKeysHandler, {
        method: 'GET',
        query: { workspaceId: seeded.workspace.id },
        headers: sessionCookie(admin.sessionToken),
      });
      expect(result.status).toBe(200);
      expect(Array.isArray((result.json as { data: unknown }).data)).toBe(true);
    });
  });

  describe('api key authentication', () => {
    const listGlasses = (jwt: string, workspaceId: string) => callAs({ apiKeyJwt: jwt }, glassesHandler, { method: 'GET', query: { workspaceId } });

    it('rejects revoked and deleted keys', async () => {
      const { a } = await seedTenantPair();
      const owner = roleUser(a, 'OWNER');
      const key = await seedApiKey(a.workspace.id, owner.user.id, ['GLASSES_READ']);
      expect((await listGlasses(key.jwt, a.workspace.id)).status).toBe(200);

      await prisma.workspaceApiKey.update({ where: { id: key.recordId }, data: { revoked: true } });
      expect((await listGlasses(key.jwt, a.workspace.id)).status).toBe(401);

      const other = await seedApiKey(a.workspace.id, owner.user.id, ['GLASSES_READ']);
      expect((await listGlasses(other.jwt, a.workspace.id)).status).toBe(200);
      const deleted = await callAs(owner, apiKeyItemHandler, { method: 'DELETE', query: { workspaceId: a.workspace.id, keyId: other.recordId } });
      expect(deleted.status).toBe(200);
      expect((await listGlasses(other.jwt, a.workspace.id)).status).toBe(401);
    });

    it('rejects keys whose creator was removed from the workspace or demoted below ADMIN', async () => {
      const { a } = await seedTenantPair();
      const admin = roleUser(a, 'ADMIN');
      const owner = roleUser(a, 'OWNER');
      const adminKey = await seedApiKey(a.workspace.id, admin.user.id, ['GLASSES_READ']);
      const ownerKey = await seedApiKey(a.workspace.id, owner.user.id, ['GLASSES_READ']);
      expect((await listGlasses(adminKey.jwt, a.workspace.id)).status).toBe(200);

      await prisma.workspaceUser.update({ where: { workspaceId_userId: { workspaceId: a.workspace.id, userId: admin.user.id } }, data: { role: 'MANAGER' } });
      expect((await listGlasses(adminKey.jwt, a.workspace.id)).status).toBe(401);

      await prisma.workspaceUser.delete({ where: { workspaceId_userId: { workspaceId: a.workspace.id, userId: owner.user.id } } });
      expect((await listGlasses(ownerKey.jwt, a.workspace.id)).status).toBe(401);
    });

    it('authorizes with the permissions stored in the database, not the token claims', async () => {
      const { a } = await seedTenantPair();
      const owner = roleUser(a, 'OWNER');
      const key = await seedApiKey(a.workspace.id, owner.user.id, ['GLASSES_READ']);
      // A token for the same key that claims more scopes than the key has.
      const inflated = createApiKeyJwt(key.keyId, a.workspace.id, ['GLASSES_READ', 'GLASSES_CREATE']);

      const create = await callAs({ apiKeyJwt: inflated }, glassesHandler, {
        method: 'POST',
        query: { workspaceId: a.workspace.id },
        body: { name: 'Sneaky', deposit: 0 },
      });
      expect(create.status).toBe(403);
      expect(await prisma.glass.count({ where: { workspaceId: a.workspace.id } })).toBe(0);

      // Scopes removed after the token was issued stop working immediately.
      await prisma.apiKeyPermission.deleteMany({ where: { apiKeyId: key.recordId } });
      expect((await listGlasses(key.jwt, a.workspace.id)).status).toBe(403);
    });
  });

  describe('api key management', () => {
    it('validates the create body and deduplicates permissions', async () => {
      const { a } = await seedTenantPair();
      const admin = roleUser(a, 'ADMIN');
      const create = (body: unknown) => callAs(admin, apiKeysHandler, { method: 'POST', query: { workspaceId: a.workspace.id }, body });

      expect((await create({ name: '' })).status).toBe(400);
      expect((await create({ name: 'x'.repeat(101) })).status).toBe(400);
      expect((await create({ name: 'Bad date', expiresAt: 'not-a-date' })).status).toBe(400);
      const past = await create({ name: 'Past', expiresAt: new Date(Date.now() - 60_000).toISOString() });
      expect(past.status).toBe(400);
      expect(errorCodeOf(past)).toBe('INVALID_EXPIRY');
      expect(await prisma.workspaceApiKey.count({ where: { workspaceId: a.workspace.id } })).toBe(0);

      const ok = await create({ name: 'Integration', permissions: ['GLASSES_READ', 'GLASSES_READ', 'GLASSES_CREATE'] });
      expect(ok.status).toBe(200);
      expect(dataOf<{ permissions: string[] }>(ok).permissions.sort()).toEqual(['GLASSES_CREATE', 'GLASSES_READ']);
      expect(await prisma.auditLog.count({ where: { workspaceId: a.workspace.id, entityType: 'WorkspaceApiKey', action: 'CREATE' } })).toBe(1);
    });

    it("cannot read or delete another tenant's key", async () => {
      const { a, b } = await seedTenantPair();
      const keyB = await seedApiKey(b.workspace.id, roleUser(b, 'OWNER').user.id, ['GLASSES_READ']);
      const ownerA = roleUser(a, 'OWNER');

      expect((await callAs(ownerA, apiKeyItemHandler, { method: 'GET', query: { workspaceId: a.workspace.id, keyId: keyB.recordId } })).status).toBe(404);
      expect((await callAs(ownerA, apiKeyItemHandler, { method: 'DELETE', query: { workspaceId: a.workspace.id, keyId: keyB.recordId } })).status).toBe(404);
      expect(await prisma.workspaceApiKey.count({ where: { id: keyB.recordId } })).toBe(1);
    });
  });

  describe('workspace', () => {
    it('validates the name on update and trims it', async () => {
      const { a } = await seedTenantPair();
      const manager = roleUser(a, 'MANAGER');
      const update = (body: unknown) => callAs(manager, workspaceHandler, { method: 'PUT', query: { workspaceId: a.workspace.id }, body });

      expect((await update({ name: '   ' })).status).toBe(400);
      expect((await update({ name: 'x'.repeat(101) })).status).toBe(400);
      expect((await update({ image: 'data:image/svg+xml;base64,PHN2Zz4=' })).status).toBe(400);
      const ok = await update({ name: '  Renamed  ' });
      expect(ok.status).toBe(200);
      expect(dataOf<{ name: string }>(ok).name).toBe('Renamed');
    });

    it('requires GUEST_MENUS_PUBLISH for API keys that change the public slug', async () => {
      const { a } = await seedTenantPair();
      const owner = roleUser(a, 'OWNER');
      const key = await seedApiKey(a.workspace.id, owner.user.id, ['WORKSPACE_UPDATE']);
      const publisher = await seedApiKey(a.workspace.id, owner.user.id, ['WORKSPACE_UPDATE', 'GUEST_MENUS_PUBLISH']);

      const denied = await callAs({ apiKeyJwt: key.jwt }, workspaceHandler, {
        method: 'PUT',
        query: { workspaceId: a.workspace.id },
        body: { publicSlug: 'my-bar' },
      });
      expect(denied.status).toBe(403);
      expect((await prisma.workspace.findUnique({ where: { id: a.workspace.id } }))?.publicSlug).toBeNull();

      const renamed = await callAs({ apiKeyJwt: key.jwt }, workspaceHandler, {
        method: 'PUT',
        query: { workspaceId: a.workspace.id },
        body: { name: 'Via key' },
      });
      expect(renamed.status).toBe(200);
      const published = await callAs({ apiKeyJwt: publisher.jwt }, workspaceHandler, {
        method: 'PUT',
        query: { workspaceId: a.workspace.id },
        body: { publicSlug: 'my-bar' },
      });
      expect(published.status).toBe(200);
    });

    it('only an owner session may delete the workspace', async () => {
      const { a, b } = await seedTenantPair();
      expect((await callAs(roleUser(a, 'ADMIN'), workspaceHandler, { method: 'DELETE', query: { workspaceId: a.workspace.id } })).status).toBe(403);
      expect((await callAs('master', workspaceHandler, { method: 'DELETE', query: { workspaceId: a.workspace.id } })).status).toBe(401);
      expect((await callAs(roleUser(a, 'OWNER'), workspaceHandler, { method: 'DELETE', query: { workspaceId: b.workspace.id } })).status).toBe(403);
      expect(await prisma.workspace.count({ where: { id: { in: [a.workspace.id, b.workspace.id] } } })).toBe(2);

      expect((await callAs(roleUser(a, 'OWNER'), workspaceHandler, { method: 'DELETE', query: { workspaceId: a.workspace.id } })).status).toBe(200);
      expect(await prisma.workspace.count({ where: { id: a.workspace.id } })).toBe(0);
    });

    it('works for the master key (no user row) on GET and settings', async () => {
      const { a } = await seedTenantPair();
      expect((await callAs('master', workspaceHandler, { method: 'GET', query: { workspaceId: a.workspace.id } })).status).toBe(200);
      const setting = await callAs('master', settingsHandler, {
        method: 'PUT',
        query: { workspaceId: a.workspace.id },
        body: { setting: 'usePrices', value: 'true' },
      });
      expect(setting.status).toBe(200);
    });

    it('creates a workspace with a validated name and lists only slim workspace fields', async () => {
      const outsider = await seedSessionUser();
      const invalid = await callAs(outsider, workspacesHandler, { method: 'POST', body: { name: '  ' } });
      expect(invalid.status).toBe(400);
      expect(errorCodeOf(invalid)).toBe('VALIDATION_ERROR');
      expect((await callAs(outsider, workspacesHandler, { method: 'POST', body: {} })).status).toBe(400);
      expect(await prisma.workspaceUser.count({ where: { userId: outsider.user.id } })).toBe(0);

      const created = await callAs(outsider, workspacesHandler, { method: 'POST', body: { name: ' New Bar ' } });
      expect(created.status).toBe(200);
      const { id, name } = dataOf<{ id: string; name: string }>(created);
      expect(name).toBe('New Bar');
      expect(await prisma.workspaceUser.findFirst({ where: { workspaceId: id, userId: outsider.user.id } })).toMatchObject({ role: 'OWNER' });

      const list = await callAs(outsider, workspacesHandler, { method: 'GET' });
      expect(list.status).toBe(200);
      expect(dataOf<Array<Record<string, unknown>>>(list).map((w) => Object.keys(w).sort())).toEqual([['description', 'id', 'image', 'name']]);
      expect((await callAs(outsider, workspacesHandler, { method: 'PUT', body: {} })).status).toBe(405);
    });
  });

  describe('audit logs, users and user settings', () => {
    it('caps the audit log page size at 200', async () => {
      const { a } = await seedTenantPair();
      const user = roleUser(a, 'USER');
      expect((await callAs(user, auditLogsHandler, { method: 'GET', query: { workspaceId: a.workspace.id, limit: '201' } })).status).toBe(400);
      expect((await callAs(user, auditLogsHandler, { method: 'GET', query: { workspaceId: a.workspace.id, limit: '200' } })).status).toBe(200);
    });

    it('only lists audit logs of the own workspace', async () => {
      const { a, b } = await seedTenantPair();
      await prisma.auditLog.create({ data: { workspaceId: b.workspace.id, entityType: 'Glass', entityId: 'glass-b', action: 'CREATE' } });
      const result = await callAs(roleUser(a, 'USER'), auditLogsHandler, { method: 'GET', query: { workspaceId: a.workspace.id, entityId: 'glass-b' } });
      expect(result.status).toBe(200);
      expect(dataOf<unknown[]>(result)).toEqual([]);
    });

    it('/api/users and /api/users/workspace-requests are GET-only and expose only slim workspace data', async () => {
      const { a } = await seedTenantPair();
      const outsider = await seedSessionUser();
      await prisma.workspaceJoinRequest.create({ data: { workspaceId: a.workspace.id, userId: outsider.user.id } });

      expect((await callAs(outsider, usersHandler, { method: 'POST' })).status).toBe(405);
      expect((await callAs(outsider, workspaceRequestsHandler, { method: 'DELETE' })).status).toBe(405);
      expect((await callAs('anonymous', usersHandler, { method: 'GET' })).status).toBe(401);

      const me = await callAs(outsider, usersHandler, { method: 'GET' });
      expect(dataOf<{ id: string }>(me).id).toBe(outsider.user.id);

      const requests = await callAs(outsider, workspaceRequestsHandler, { method: 'GET' });
      expect(requests.status).toBe(200);
      expect(dataOf<Array<{ workspace: Record<string, unknown> }>>(requests)[0]!.workspace).toEqual({ id: a.workspace.id, name: a.workspace.name });
    });

    it('bounds user setting values', async () => {
      const outsider = await seedSessionUser();
      const tooLong = await callAs(outsider, userSettingsHandler, { method: 'PUT', body: { setting: 'theme', value: 'x'.repeat(1001) } });
      expect(tooLong.status).toBe(400);
      const ok = await callAs(outsider, userSettingsHandler, { method: 'PUT', body: { setting: 'theme', value: 'dark' } });
      expect(ok.status).toBe(200);
    });
  });
});
