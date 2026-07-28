import { describe, it, expect } from 'vitest';
import { collectionHandler as queueHandler, addHandler } from '@lib/api/v1/queue';
import { cocktailsCollectionHandler } from '@lib/api/v1/statistics';
import { invokeHandler } from '@test/helpers/invokeHandler';
import { sessionCookie } from '@test/helpers/authFixtures';
import { findUserByRole, seedGlass, seedWorkspace } from '@test/helpers/dbFixtures';
import { collectionHandler as cocktailsHandler } from '@lib/api/v1/cocktails';

describe('queue and statistics v1 integration', () => {
  async function setupWithCocktail() {
    const seeded = await seedWorkspace({
      users: [{ role: 'USER' }, { role: 'MANAGER' }],
    });
    const manager = findUserByRole(seeded, 'MANAGER');
    const glass = await seedGlass(seeded.workspace.id);

    const createResult = await invokeHandler(cocktailsHandler, {
      method: 'POST',
      query: { workspaceId: seeded.workspace.id },
      body: { name: 'Queue Cocktail', glassId: glass.id },
      headers: sessionCookie(manager.sessionToken),
    });
    const cocktailId = (createResult.json as { data: { id: string } }).data.id;

    return { seeded, cocktailId };
  }

  describe('queue', () => {
    it('returns 401 without auth', async () => {
      const seeded = await seedWorkspace({ users: [{ role: 'USER' }] });
      const result = await invokeHandler(queueHandler, {
        method: 'GET',
        query: { workspaceId: seeded.workspace.id },
      });
      expect(result.status).toBe(401);
    });

    it('adds cocktail to queue and lists items', async () => {
      const { seeded, cocktailId } = await setupWithCocktail();
      const user = findUserByRole(seeded, 'USER');

      const addResult = await invokeHandler(addHandler, {
        method: 'POST',
        query: { workspaceId: seeded.workspace.id },
        body: { cocktailId, amount: 2 },
        headers: sessionCookie(user.sessionToken),
      });
      expect(addResult.status).toBe(200);
      expect((addResult.json as { data: unknown[] }).data).toHaveLength(2);

      const listResult = await invokeHandler(queueHandler, {
        method: 'GET',
        query: { workspaceId: seeded.workspace.id },
        headers: sessionCookie(user.sessionToken),
      });
      expect(listResult.status).toBe(200);
      expect((listResult.json as { data: unknown[] }).data.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('statistics', () => {
    it('returns 401 without auth for statistics cocktails list', async () => {
      const seeded = await seedWorkspace({ users: [{ role: 'USER' }] });
      const result = await invokeHandler(cocktailsCollectionHandler, {
        method: 'GET',
        query: { workspaceId: seeded.workspace.id },
      });
      expect(result.status).toBe(401);
    });

    it('lists cocktail statistics for USER', async () => {
      const seeded = await seedWorkspace({ users: [{ role: 'USER' }] });
      const user = findUserByRole(seeded, 'USER');
      const result = await invokeHandler(cocktailsCollectionHandler, {
        method: 'GET',
        query: { workspaceId: seeded.workspace.id },
        headers: sessionCookie(user.sessionToken),
      });
      expect(result.status).toBe(200);
      expect(result.json).toHaveProperty('data');
    });
  });
});
