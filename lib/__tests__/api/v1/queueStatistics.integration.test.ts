import { describe, it, expect } from 'vitest';
import prisma from '../../../../prisma/prisma';
import { collectionHandler as queueHandler, addHandler, removeHandler, itemHandler as queueItemHandler } from '@lib/api/v1/queue';
import { cocktailsAddHandler, cocktailsCollectionHandler, cocktailsItemHandler, logsCollectionHandler, logsItemHandler } from '@lib/api/v1/statistics';
import { compareHandler, cocktailOrdersHandler, setItemHandler, setsHandler } from '@lib/api/v1/statisticsAdvanced';
import { invokeHandler } from '@test/helpers/invokeHandler';
import { sessionCookie } from '@test/helpers/authFixtures';
import { findUserByRole, seedApiKey, seedGlass, seedWorkspace } from '@test/helpers/dbFixtures';
import { callAs, dataOf, errorCodeOf, roleUser, seedTenantPair } from '@test/helpers/scenario';
import { seedCard, seedContent, seedQueueItems, seedSavedSet, seedStatistic } from '@test/helpers/fixtures/g3';
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

async function setupPair() {
  const pair = await seedTenantPair();
  const contentA = await seedContent(pair.a.workspace.id);
  const contentB = await seedContent(pair.b.workspace.id);
  return { ...pair, contentA, contentB };
}

describe('queue hardening', () => {
  it('rejects a foreign cocktail and oversized amounts on add without writing', async () => {
    const { a, contentB } = await setupPair();
    const user = roleUser(a, 'USER');
    const query = { workspaceId: a.workspace.id };

    const foreign = await callAs(user, addHandler, { method: 'POST', query, body: { cocktailId: contentB.cocktail.id } });
    expect(foreign.status).toBe(400);
    expect(errorCodeOf(foreign)).toBe('INVALID_REFERENCE');
    const tooMany = await callAs(user, addHandler, { method: 'POST', query, body: { cocktailId: contentB.cocktail.id, amount: 51 } });
    expect(tooMany.status).toBe(400);
    expect(await prisma.cocktailQueue.count()).toBe(0);
  });

  it('adds N items in one statement', async () => {
    const { a, contentA } = await setupPair();
    const result = await callAs(roleUser(a, 'USER'), addHandler, {
      method: 'POST',
      query: { workspaceId: a.workspace.id },
      body: { cocktailId: contentA.cocktail.id, amount: 50, notes: ' no ice ' },
    });
    expect(result.status).toBe(200);
    expect(dataOf<Array<{ notes: string | null; cocktail: { id: string } }>>(result)).toHaveLength(50);
    expect(await prisma.cocktailQueue.count({ where: { workspaceId: a.workspace.id, notes: 'no ice' } })).toBe(50);
  });

  it('removes each queued item exactly once under concurrency and 404s when empty', async () => {
    const { a, contentA } = await setupPair();
    await seedQueueItems(a.workspace.id, contentA.cocktail.id, 5);

    const results = await Promise.all(
      Array.from({ length: 12 }, () =>
        callAs(roleUser(a, 'USER'), removeHandler, { method: 'POST', query: { workspaceId: a.workspace.id }, body: { cocktailId: contentA.cocktail.id } }),
      ),
    );
    const statuses = results.map((r) => r.status).sort();
    expect(statuses.filter((s) => s === 200)).toHaveLength(5);
    expect(statuses.filter((s) => s === 404)).toHaveLength(7);
    expect(new Set(results.filter((r) => r.status === 200).map((r) => dataOf<{ id: string }>(r).id)).size).toBe(5);
    expect(await prisma.cocktailQueue.count()).toBe(0);
  });

  it('only removes items with matching notes', async () => {
    const { a, contentA } = await setupPair();
    await seedQueueItems(a.workspace.id, contentA.cocktail.id, 1, 'extra lime');
    const query = { workspaceId: a.workspace.id };
    const user = roleUser(a, 'USER');

    expect((await callAs(user, removeHandler, { method: 'POST', query, body: { cocktailId: contentA.cocktail.id, notes: '-' } })).status).toBe(404);
    const removed = await callAs(user, removeHandler, { method: 'POST', query, body: { cocktailId: contentA.cocktail.id, notes: 'extra lime' } });
    expect(removed.status).toBe(200);
    expect(dataOf<{ notes: string; cocktail: { name: string } }>(removed)).toMatchObject({ notes: 'extra lime', cocktail: { name: contentA.cocktail.name } });
  });

  it('cannot remove or update another workspace’s queue items', async () => {
    const { a, b, contentB } = await setupPair();
    const [itemB] = await seedQueueItems(b.workspace.id, contentB.cocktail.id, 1);
    const user = roleUser(a, 'USER');

    const remove = await callAs(user, removeHandler, { method: 'POST', query: { workspaceId: a.workspace.id }, body: { cocktailId: contentB.cocktail.id } });
    expect(remove.status).toBe(404);
    const update = await callAs(user, queueItemHandler, {
      method: 'PUT',
      query: { workspaceId: a.workspace.id, queueItemId: itemB.id },
      body: { inProgress: true },
    });
    expect(update.status).toBe(404);
    expect(await prisma.cocktailQueue.findUnique({ where: { id: itemB.id } })).toEqual(itemB);
  });
});

describe('statistics hardening', () => {
  it('consumes queue items atomically when several bartenders log the same cocktail', async () => {
    const { a, contentA } = await setupPair();
    await seedQueueItems(a.workspace.id, contentA.cocktail.id, 3);

    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        callAs(roleUser(a, 'USER'), cocktailsAddHandler, {
          method: 'POST',
          query: { workspaceId: a.workspace.id },
          body: { cocktailId: contentA.cocktail.id, actionSource: 'QUEUE' },
        }),
      ),
    );
    expect(results.map((r) => r.status)).toEqual(Array(6).fill(200));
    expect(await prisma.cocktailStatisticItem.count({ where: { workspaceId: a.workspace.id } })).toBe(6);
    expect(await prisma.cocktailQueue.count()).toBe(0);
  });

  it('asks which item to consume when noted items exist and writes nothing', async () => {
    const { a, contentA } = await setupPair();
    await seedQueueItems(a.workspace.id, contentA.cocktail.id, 1, 'no sugar');
    await seedQueueItems(a.workspace.id, contentA.cocktail.id, 1);

    const result = await callAs(roleUser(a, 'USER'), cocktailsAddHandler, {
      method: 'POST',
      query: { workspaceId: a.workspace.id },
      body: { cocktailId: contentA.cocktail.id },
    });
    expect(result.status).toBe(400);
    expect(errorCodeOf(result)).toBe('STATISTIC_QUEUE_AMBIGUOUS');
    expect(await prisma.cocktailQueue.count()).toBe(2);
    expect(await prisma.cocktailStatisticItem.count()).toBe(0);
  });

  it('rejects foreign cocktail/card ids without touching either workspace', async () => {
    const { a, b, contentA, contentB } = await setupPair();
    await seedQueueItems(b.workspace.id, contentB.cocktail.id, 1);
    const cardB = await seedCard(b.workspace.id, contentB.cocktail.id);
    const user = roleUser(a, 'USER');
    const query = { workspaceId: a.workspace.id };

    const foreignCocktail = await callAs(user, cocktailsAddHandler, { method: 'POST', query, body: { cocktailId: contentB.cocktail.id } });
    expect(foreignCocktail.status).toBe(400);
    const foreignCard = await callAs(user, cocktailsAddHandler, {
      method: 'POST',
      query,
      body: { cocktailId: contentA.cocktail.id, cocktailCardId: cardB.id },
    });
    expect(foreignCard.status).toBe(400);

    expect(await prisma.cocktailStatisticItem.count()).toBe(0);
    expect(await prisma.cocktailQueue.count({ where: { workspaceId: b.workspace.id } })).toBe(1);
  });

  it('records master-key statistics without a user', async () => {
    const { a, contentA } = await setupPair();
    const result = await callAs('master', cocktailsAddHandler, {
      method: 'POST',
      query: { workspaceId: a.workspace.id },
      body: { cocktailId: contentA.cocktail.id, cocktailCardId: 'search' },
    });
    expect(result.status).toBe(200);
    expect(dataOf<{ user: unknown; cocktailCard: unknown }>(result)).toMatchObject({ user: null, cocktailCard: null });
  });

  it('cannot delete another workspace’s statistic entries', async () => {
    const { a, b, contentB } = await setupPair();
    const statB = await seedStatistic(b.workspace.id, contentB.cocktail.id);
    const manager = roleUser(a, 'MANAGER');

    for (const handler of [cocktailsItemHandler, logsItemHandler]) {
      const result = await callAs(manager, handler, { method: 'DELETE', query: { workspaceId: a.workspace.id, cocktailStatisticId: statB.id } });
      expect(result.status).toBe(404);
    }
    expect(await prisma.cocktailStatisticItem.count({ where: { id: statB.id } })).toBe(1);
  });

  it('bounds pagination and validates dates', async () => {
    const { a, contentA } = await setupPair();
    const user = roleUser(a, 'USER');
    const query = { workspaceId: a.workspace.id };

    expect((await callAs(user, logsCollectionHandler, { method: 'GET', query: { ...query, limit: '201' } })).status).toBe(400);
    expect((await callAs(user, logsCollectionHandler, { method: 'GET', query: { ...query, limit: '200' } })).status).toBe(200);
    expect((await callAs(user, cocktailsCollectionHandler, { method: 'GET', query: { ...query, startDate: 'not-a-date' } })).status).toBe(400);
    expect((await callAs(user, cocktailOrdersHandler, { method: 'GET', query: { ...query, cocktailId: contentA.cocktail.id, limit: '10000' } })).status).toBe(
      400,
    );
    expect((await callAs(user, compareHandler, { method: 'GET', query: { ...query, type: 'TAG_SET', items: '["a"]', endDate: 'x' } })).status).toBe(400);
  });
});

describe('advanced statistics saved sets', () => {
  it('requires write scopes for saved-set writes', async () => {
    const { a, contentA } = await setupPair();
    const owner = roleUser(a, 'OWNER').user;
    const readKey = await seedApiKey(a.workspace.id, owner.id, ['STATISTICS_READ']);
    const writeKey = await seedApiKey(a.workspace.id, owner.id, ['STATISTICS_CREATE', 'STATISTICS_DELETE']);
    const query = { workspaceId: a.workspace.id };
    const body = { name: 'Favourites', type: 'COCKTAIL_SET', logic: 'AND', items: [contentA.cocktail.id] };

    expect((await callAs({ apiKeyJwt: readKey.jwt }, setsHandler, { method: 'POST', query, body })).status).toBe(403);
    const created = await callAs({ apiKeyJwt: writeKey.jwt }, setsHandler, { method: 'POST', query, body });
    expect(created.status).toBe(200);
    const setId = (created.json as { data: { id: string } }).data.id;

    expect((await callAs({ apiKeyJwt: readKey.jwt }, setsHandler, { method: 'DELETE', query: { ...query, id: setId } })).status).toBe(403);
    expect((await callAs({ apiKeyJwt: writeKey.jwt }, setsHandler, { method: 'DELETE', query: { ...query, id: setId } })).status).toBe(200);
  });

  it('scopes saved sets and never leaks foreign cocktail names', async () => {
    const { a, b, contentA, contentB } = await setupPair();
    const user = roleUser(a, 'USER');
    const query = { workspaceId: a.workspace.id };
    const setB = await seedSavedSet(b.workspace.id, [contentB.cocktail.id]);

    const foreignItems = await callAs(user, setsHandler, {
      method: 'POST',
      query,
      body: { name: 'Sneaky', type: 'COCKTAIL_SET', items: [contentB.cocktail.id] },
    });
    expect(foreignItems.status).toBe(400);

    const put = await callAs(user, setsHandler, { method: 'PUT', query, body: { id: setB.id, name: 'Hijacked' } });
    expect(put.status).toBe(404);
    const del = await callAs(user, setsHandler, { method: 'DELETE', query: { ...query, id: setB.id } });
    expect(del.status).toBe(404);
    expect(await prisma.statisticSavedSet.findUnique({ where: { id: setB.id } })).toEqual(setB);

    // A legacy set in A that references B's cocktail must not reveal it.
    const legacySet = await seedSavedSet(a.workspace.id, [contentA.cocktail.id, contentB.cocktail.id]);
    const detail = await callAs(user, setItemHandler, { method: 'GET', query: { ...query, setId: legacySet.id } });
    expect(detail.status).toBe(200);
    expect(JSON.stringify(detail.json)).not.toContain(contentB.cocktail.name);
    expect((detail.json as { data: { kpis: { cocktailCount: number } } }).data.kpis.cocktailCount).toBe(1);
  });
});
