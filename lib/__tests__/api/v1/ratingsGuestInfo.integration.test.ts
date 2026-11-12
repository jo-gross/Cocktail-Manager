import { describe, it, expect } from 'vitest';
import { collectionHandler as ratingsHandler, itemHandler as ratingHandler } from '@lib/api/v1/ratings';
import { bulkHandler, cocktailGuestInfoHandler, overviewHandler } from '@lib/api/v1/guestInfo';
import { seedApiKey } from '@test/helpers/dbFixtures';
import { callAs, dataOf, errorCodeOf, roleUser, seedTenantPair } from '@test/helpers/scenario';
import { seedFullCocktail, seedRecipeDeps } from '@test/helpers/fixtures/g2';
import type { RatingDto } from '@lib/schemas/ratings';
import type { GuestInfoOverview } from '@lib/schemas/guestInfo';
import prisma from '../../../../prisma/prisma';

describe('ratings v1 integration', () => {
  it('creates and lists ratings of an own cocktail', async () => {
    const { a } = await seedTenantPair();
    const cocktail = await seedFullCocktail(a.workspace.id, await seedRecipeDeps(a.workspace.id));
    const query = { workspaceId: a.workspace.id, cocktailId: cocktail.id };

    const created = await callAs(roleUser(a, 'USER'), ratingsHandler, { method: 'POST', query, body: { name: 'Anna', rating: 5, comment: 'Great' } });
    expect(created.status).toBe(200);
    expect(dataOf<RatingDto>(created)).toMatchObject({ name: 'Anna', rating: 5, comment: 'Great' });

    const list = await callAs(roleUser(a, 'USER'), ratingsHandler, { method: 'GET', query });
    expect(dataOf<RatingDto[]>(list)).toHaveLength(1);
  });

  it.each([{ rating: 0 }, { rating: 6 }, { rating: 2.5 }, { rating: 3, comment: 'x'.repeat(2001) }, { rating: 3, name: 'x'.repeat(101) }])(
    'rejects invalid rating input %j',
    async (body) => {
      const { a } = await seedTenantPair();
      const cocktail = await seedFullCocktail(a.workspace.id, await seedRecipeDeps(a.workspace.id));
      const result = await callAs(roleUser(a, 'USER'), ratingsHandler, {
        method: 'POST',
        query: { workspaceId: a.workspace.id, cocktailId: cocktail.id },
        body,
      });
      expect(result.status).toBe(400);
      expect(await prisma.cocktailRating.count()).toBe(0);
    },
  );

  it("returns 404 for another tenant's cocktail (list, create) and writes nothing", async () => {
    const { a, b } = await seedTenantPair();
    const cocktailB = await seedFullCocktail(b.workspace.id, await seedRecipeDeps(b.workspace.id));
    await prisma.cocktailRating.create({ data: { cocktailId: cocktailB.id, rating: 2, comment: 'secret' } });
    const query = { workspaceId: a.workspace.id, cocktailId: cocktailB.id };

    for (const caller of [roleUser(a, 'OWNER'), 'master' as const]) {
      const list = await callAs(caller, ratingsHandler, { method: 'GET', query });
      expect(list.status).toBe(404);
      expect(JSON.stringify(list.json)).not.toContain('secret');
      expect((await callAs(caller, ratingsHandler, { method: 'POST', query, body: { rating: 1 } })).status).toBe(404);
    }
    expect(await prisma.cocktailRating.count({ where: { cocktailId: cocktailB.id } })).toBe(1);
  });

  it("deletes only ratings of the addressed cocktail in the caller's workspace", async () => {
    const { a, b } = await seedTenantPair();
    const depsA = await seedRecipeDeps(a.workspace.id);
    const cocktailA = await seedFullCocktail(a.workspace.id, depsA);
    const otherA = await seedFullCocktail(a.workspace.id, depsA);
    const cocktailB = await seedFullCocktail(b.workspace.id, await seedRecipeDeps(b.workspace.id));
    const ratingB = await prisma.cocktailRating.create({ data: { cocktailId: cocktailB.id, rating: 3 } });
    const ratingOther = await prisma.cocktailRating.create({ data: { cocktailId: otherA.id, rating: 3 } });
    const admin = roleUser(a, 'ADMIN');

    const attempts = [
      { cocktailId: cocktailA.id, ratingId: ratingB.id },
      { cocktailId: cocktailB.id, ratingId: ratingB.id },
      { cocktailId: cocktailA.id, ratingId: ratingOther.id },
    ];
    for (const ids of attempts) {
      const result = await callAs(admin, ratingHandler, { method: 'DELETE', query: { workspaceId: a.workspace.id, ...ids } });
      expect(result.status).toBe(404);
    }
    expect(await prisma.cocktailRating.count()).toBe(2);

    const ok = await callAs(admin, ratingHandler, {
      method: 'DELETE',
      query: { workspaceId: a.workspace.id, cocktailId: otherA.id, ratingId: ratingOther.id },
    });
    expect(ok.status).toBe(200);
    expect(await prisma.cocktailRating.count()).toBe(1);
  });
});

describe('guest info v1 integration', () => {
  it("returns 404 for another tenant's cocktail guest info", async () => {
    const { a, b } = await seedTenantPair();
    const cocktailB = await seedFullCocktail(b.workspace.id, await seedRecipeDeps(b.workspace.id));
    const result = await callAs(roleUser(a, 'OWNER'), cocktailGuestInfoHandler, {
      method: 'GET',
      query: { workspaceId: a.workspace.id, cocktailId: cocktailB.id },
    });
    expect(result.status).toBe(404);
  });

  it('overview only contains own ingredients and garnishes', async () => {
    const { a, b } = await seedTenantPair();
    await seedRecipeDeps(a.workspace.id, 'mine');
    await seedRecipeDeps(b.workspace.id, 'theirs');
    const result = await callAs(roleUser(a, 'USER'), overviewHandler, { method: 'GET', query: { workspaceId: a.workspace.id } });
    const overview = dataOf<GuestInfoOverview>(result);
    expect(overview.ingredients.map((i) => i.name)).toEqual(['Rum mine']);
    expect(overview.garnishes.map((g) => g.name)).toEqual(['Lime mine']);
  });

  it('bulk-updates own entries', async () => {
    const { a } = await seedTenantPair();
    const deps = await seedRecipeDeps(a.workspace.id);
    const result = await callAs(roleUser(a, 'MANAGER'), bulkHandler, {
      method: 'PUT',
      query: { workspaceId: a.workspace.id },
      body: { ingredients: [{ id: deps.ingredient.id, abv: 40, allergens: ['MILK'] }], garnishes: [{ id: deps.garnish.id, guestInfoComplete: true }] },
    });
    expect(result.status).toBe(200);
    expect(dataOf(result)).toEqual({ ingredients: 1, garnishes: 1 });
    expect((await prisma.ingredient.findUniqueOrThrow({ where: { id: deps.ingredient.id } })).abv).toBe(40);
    expect((await prisma.garnish.findUniqueOrThrow({ where: { id: deps.garnish.id } })).guestInfoComplete).toBe(true);
  });

  it("rejects a batch containing another tenant's id (400) without updating anything", async () => {
    const { a, b } = await seedTenantPair();
    const depsA = await seedRecipeDeps(a.workspace.id);
    const depsB = await seedRecipeDeps(b.workspace.id);

    for (const body of [
      {
        ingredients: [
          { id: depsA.ingredient.id, abv: 12 },
          { id: depsB.ingredient.id, abv: 99 },
        ],
      },
      { ingredients: [{ id: depsA.ingredient.id, abv: 12 }], garnishes: [{ id: depsB.garnish.id, guestInfoComplete: true }] },
    ]) {
      const result = await callAs(roleUser(a, 'OWNER'), bulkHandler, { method: 'PUT', query: { workspaceId: a.workspace.id }, body });
      expect(result.status).toBe(400);
      expect(errorCodeOf(result)).toBe('INVALID_REFERENCE');
    }

    expect((await prisma.ingredient.findUniqueOrThrow({ where: { id: depsA.ingredient.id } })).abv).toBeNull();
    expect((await prisma.ingredient.findUniqueOrThrow({ where: { id: depsB.ingredient.id } })).abv).toBeNull();
    expect((await prisma.garnish.findUniqueOrThrow({ where: { id: depsB.garnish.id } })).guestInfoComplete).toBe(false);
    expect(await prisma.auditLog.count()).toBe(0);
  });

  it('requires GARNISHES_UPDATE on API keys for garnish edits', async () => {
    const { a } = await seedTenantPair();
    const deps = await seedRecipeDeps(a.workspace.id);
    const ownerId = roleUser(a, 'OWNER').user.id;
    const ingredientsOnly = await seedApiKey(a.workspace.id, ownerId, ['INGREDIENTS_UPDATE']);
    const both = await seedApiKey(a.workspace.id, ownerId, ['INGREDIENTS_UPDATE', 'GARNISHES_UPDATE']);
    const options = { method: 'PUT', query: { workspaceId: a.workspace.id }, body: { garnishes: [{ id: deps.garnish.id, guestInfoComplete: true }] } };

    expect((await callAs({ apiKeyJwt: ingredientsOnly.jwt }, bulkHandler, options)).status).toBe(403);
    expect((await prisma.garnish.findUniqueOrThrow({ where: { id: deps.garnish.id } })).guestInfoComplete).toBe(false);
    expect((await callAs({ apiKeyJwt: both.jwt }, bulkHandler, options)).status).toBe(200);
  });
});
