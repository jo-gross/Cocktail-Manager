import { describe, it, expect } from 'vitest';
import prisma from '../../../../prisma/prisma';
import { archiveHandler, cloneHandler, collectionHandler, itemHandler, unarchiveHandler } from '@lib/api/v1/cards';
import { callAs, dataOf, errorCodeOf, roleUser, seedTenantPair } from '@test/helpers/scenario';
import { seedApiKey } from '@test/helpers/dbFixtures';
import { seedCard, seedContent } from '@test/helpers/fixtures/g3';
import type { CardDto } from '@lib/schemas/cards';

async function setup() {
  const pair = await seedTenantPair();
  const contentA = await seedContent(pair.a.workspace.id);
  const contentB = await seedContent(pair.b.workspace.id);
  const cardB = await seedCard(pair.b.workspace.id, contentB.cocktail.id, 'B card');
  return { ...pair, contentA, contentB, cardB };
}

async function cardState(id: string) {
  return prisma.cocktailCard.findUnique({
    where: { id },
    include: { groups: { orderBy: { groupNumber: 'asc' }, include: { items: { orderBy: { itemNumber: 'asc' } } } } },
  });
}

describe('cards v1 integration', () => {
  it('creates, updates (stable group ids), archives, clones and deletes a card with audit logs', async () => {
    const { a, contentA } = await setup();
    const manager = roleUser(a, 'MANAGER');
    const query = { workspaceId: a.workspace.id };

    const created = await callAs(manager, collectionHandler, {
      method: 'POST',
      query,
      body: { name: 'Summer', groups: [{ name: 'Classics', groupNumber: 0, items: [{ cocktailId: contentA.cocktail.id, itemNumber: 0 }] }] },
    });
    expect(created.status).toBe(200);
    const card = dataOf<CardDto>(created);
    const groupId = card.groups[0].id;

    const updated = await callAs(manager, itemHandler, {
      method: 'PUT',
      query: { ...query, cardId: card.id },
      body: {
        name: 'Summer 2',
        groups: [
          { id: groupId, name: 'Classics renamed', groupNumber: 0, items: [{ cocktailId: contentA.cocktail.id, itemNumber: 0, specialPrice: 5 }] },
          { name: 'New', groupNumber: 1, items: [] },
        ],
      },
    });
    expect(updated.status).toBe(200);
    const updatedCard = dataOf<CardDto>(updated);
    expect(updatedCard.groups.find((g) => g.name === 'Classics renamed')?.id).toBe(groupId);
    expect(updatedCard.groups).toHaveLength(2);

    expect((await callAs(manager, archiveHandler, { method: 'PUT', query: { ...query, cardId: card.id } })).status).toBe(200);
    expect((await cardState(card.id))?.archived).toBe(true);
    expect((await callAs(manager, unarchiveHandler, { method: 'PUT', query: { ...query, cardId: card.id } })).status).toBe(200);

    const cloned = await callAs(manager, cloneHandler, { method: 'POST', query: { ...query, cardId: card.id }, body: { name: 'Copy' } });
    expect(cloned.status).toBe(200);
    expect(dataOf<CardDto>(cloned).groups).toHaveLength(2);

    expect((await callAs(roleUser(a, 'ADMIN'), itemHandler, { method: 'DELETE', query: { ...query, cardId: card.id } })).status).toBe(200);
    expect(await cardState(card.id)).toBeNull();

    const actions = (await prisma.auditLog.findMany({ where: { entityId: card.id, entityType: 'CocktailCard' }, orderBy: { createdAt: 'asc' } })).map(
      (log) => log.action,
    );
    expect(actions).toEqual(['CREATE', 'UPDATE', 'UPDATE', 'UPDATE', 'DELETE']);
  });

  it('returns 404 for another workspace’s card on every operation and leaves it unchanged', async () => {
    const { a, contentA, cardB } = await setup();
    const before = await cardState(cardB.id);
    const query = { workspaceId: a.workspace.id, cardId: cardB.id };
    const owner = roleUser(a, 'OWNER');

    const results = [
      await callAs(owner, itemHandler, { method: 'GET', query }),
      await callAs(owner, itemHandler, {
        method: 'PUT',
        query,
        body: { name: 'Hijacked', groups: [{ id: cardB.groups[0].id, name: 'x', items: [{ cocktailId: contentA.cocktail.id }] }] },
      }),
      await callAs(owner, archiveHandler, { method: 'PUT', query }),
      await callAs(owner, unarchiveHandler, { method: 'PUT', query }),
      await callAs(owner, cloneHandler, { method: 'POST', query, body: { name: 'Stolen' } }),
      await callAs(owner, itemHandler, { method: 'DELETE', query }),
      await callAs('master', itemHandler, { method: 'DELETE', query }),
    ];
    expect(results.map((r) => r.status)).toEqual([404, 404, 404, 404, 404, 404, 404]);

    expect(await cardState(cardB.id)).toEqual(before);
    expect(await prisma.cocktailCard.count({ where: { workspaceId: a.workspace.id } })).toBe(0);
  });

  it('rejects foreign cocktail ids in the body (400) without writing', async () => {
    const { a, contentA, contentB } = await setup();
    const manager = roleUser(a, 'MANAGER');
    const query = { workspaceId: a.workspace.id };

    const create = await callAs(manager, collectionHandler, {
      method: 'POST',
      query,
      body: { name: 'Bad', groups: [{ name: 'G', items: [{ cocktailId: contentB.cocktail.id }] }] },
    });
    expect(create.status).toBe(400);
    expect(errorCodeOf(create)).toBe('INVALID_REFERENCE');
    expect(await prisma.cocktailCard.count({ where: { workspaceId: a.workspace.id } })).toBe(0);

    const cardA = await seedCard(a.workspace.id, contentA.cocktail.id);
    const before = await cardState(cardA.id);
    const update = await callAs(manager, itemHandler, {
      method: 'PUT',
      query: { ...query, cardId: cardA.id },
      body: { name: 'Changed', groups: [{ id: cardA.groups[0].id, name: 'G', items: [{ cocktailId: contentB.cocktail.id }] }] },
    });
    expect(update.status).toBe(400);
    expect(await cardState(cardA.id)).toEqual(before);
  });

  it('enforces roles and API-key scopes', async () => {
    const { a, contentA } = await setup();
    const owner = roleUser(a, 'OWNER').user;
    const readKey = await seedApiKey(a.workspace.id, owner.id, ['CARDS_READ']);
    const body = { name: 'Nope', groups: [{ name: 'G', items: [{ cocktailId: contentA.cocktail.id }] }] };

    expect((await callAs(roleUser(a, 'USER'), collectionHandler, { method: 'POST', query: { workspaceId: a.workspace.id }, body })).status).toBe(403);
    expect((await callAs({ apiKeyJwt: readKey.jwt }, collectionHandler, { method: 'POST', query: { workspaceId: a.workspace.id }, body })).status).toBe(403);
    expect(await prisma.cocktailCard.count({ where: { workspaceId: a.workspace.id } })).toBe(0);
  });

  it('serializes concurrent updates of the same card (no duplicated groups/items)', async () => {
    const { a, contentA } = await setup();
    const cardA = await seedCard(a.workspace.id, contentA.cocktail.id);
    const groupId = cardA.groups[0].id;

    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        callAs(roleUser(a, 'MANAGER'), itemHandler, {
          method: 'PUT',
          query: { workspaceId: a.workspace.id, cardId: cardA.id },
          body: {
            name: `Version ${i}`,
            groups: [
              { id: groupId, name: `Kept ${i}`, groupNumber: 0, items: [{ cocktailId: contentA.cocktail.id, itemNumber: 0 }] },
              { name: `New ${i}`, groupNumber: 1, items: [{ cocktailId: contentA.cocktail.id, itemNumber: 0 }] },
            ],
          },
        }),
      ),
    );
    expect(results.map((r) => r.status)).toEqual(Array(6).fill(200));

    const state = await cardState(cardA.id);
    expect(state?.groups).toHaveLength(2);
    expect(state?.groups[0].id).toBe(groupId);
    expect(state?.groups.every((group) => group.items.length === 1)).toBe(true);
    const version = state!.name.replace('Version ', '');
    expect(state?.groups.map((g) => g.name)).toEqual([`Kept ${version}`, `New ${version}`]);
  });
});
