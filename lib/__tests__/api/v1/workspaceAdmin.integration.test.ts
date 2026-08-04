import { describe, it, expect } from 'vitest';
import { collectionHandler as usersCollectionHandler } from '@lib/api/v1/workspaceUsers';
import { collectionHandler as joinCodesHandler } from '@lib/api/v1/joinCodes';
import { collectionHandler as apiKeysHandler } from '@lib/api/v1/apiKeys';
import { invokeHandler } from '@test/helpers/invokeHandler';
import { sessionCookie } from '@test/helpers/authFixtures';
import { findUserByRole, seedApiKey, seedWorkspace } from '@test/helpers/dbFixtures';

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
});
