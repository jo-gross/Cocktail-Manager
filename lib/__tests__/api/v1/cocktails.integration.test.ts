import { describe, it, expect } from 'vitest';
import {
  archiveHandler,
  availabilityHandler,
  cloneHandler,
  collectionHandler,
  exportJsonHandler,
  exportPdfHandler,
  imageHandler,
  itemHandler,
  unarchiveHandler,
} from '@lib/api/v1/cocktails';
import { invokeHandler } from '@test/helpers/invokeHandler';
import { sessionCookie } from '@test/helpers/authFixtures';
import { findUserByRole, seedApiKey, seedGlass, seedWorkspace } from '@test/helpers/dbFixtures';
import { callAs, dataOf, errorCodeOf, roleUser, seedTenantPair } from '@test/helpers/scenario';
import {
  cocktailBody,
  cocktailSnapshot,
  loadCocktail,
  PNG_DATA_URI,
  seedFullCocktail,
  seedRecipeDeps,
  SVG_DATA_URI,
  workspaceContentCounts,
} from '@test/helpers/fixtures/g2';
import type { CocktailDto } from '@lib/schemas/cocktails';
import { generateHtmlForCocktails } from '@lib/api/controllers/cocktailsPorting';
import prisma from '../../../../prisma/prisma';

describe('cocktails v1 integration', () => {
  async function setup() {
    return seedWorkspace({
      users: [{ role: 'USER' }, { role: 'MANAGER' }, { role: 'ADMIN' }],
    });
  }

  it('GET collection returns 401 without auth', async () => {
    const seeded = await setup();
    const result = await invokeHandler(collectionHandler, {
      method: 'GET',
      query: { workspaceId: seeded.workspace.id },
    });
    expect(result.status).toBe(401);
  });

  it('POST collection returns 403 for USER role', async () => {
    const seeded = await setup();
    const user = findUserByRole(seeded, 'USER');
    const result = await invokeHandler(collectionHandler, {
      method: 'POST',
      query: { workspaceId: seeded.workspace.id },
      body: { name: 'Mojito' },
      headers: sessionCookie(user.sessionToken),
    });
    expect(result.status).toBe(403);
  });

  it('creates and lists cocktails as MANAGER', async () => {
    const seeded = await setup();
    const manager = findUserByRole(seeded, 'MANAGER');
    const glass = await seedGlass(seeded.workspace.id);

    const createResult = await invokeHandler(collectionHandler, {
      method: 'POST',
      query: { workspaceId: seeded.workspace.id },
      body: { name: 'Mojito', glassId: glass.id },
      headers: sessionCookie(manager.sessionToken),
    });
    expect(createResult.status).toBe(200);
    expect((createResult.json as { data: { name: string } }).data.name).toBe('Mojito');

    const listResult = await invokeHandler(collectionHandler, {
      method: 'GET',
      query: { workspaceId: seeded.workspace.id },
      headers: sessionCookie(findUserByRole(seeded, 'USER').sessionToken),
    });
    expect(listResult.status).toBe(200);
    expect((listResult.json as { data: unknown[] }).data.length).toBeGreaterThanOrEqual(1);
  });

  describe('create', () => {
    it('creates a full recipe (steps, lines, garnish, image) with an audit entry', async () => {
      const { a } = await seedTenantPair();
      const deps = await seedRecipeDeps(a.workspace.id);
      const result = await callAs(roleUser(a, 'MANAGER'), collectionHandler, {
        method: 'POST',
        query: { workspaceId: a.workspace.id },
        body: cocktailBody(deps, { name: 'Daiquiri', image: PNG_DATA_URI }),
      });
      expect(result.status).toBe(200);
      const created = dataOf<CocktailDto>(result);
      expect(created.hasImage).toBe(true);
      expect(created.steps).toHaveLength(1);
      expect(created.steps[0].ingredients[0].ingredient?.id).toBe(deps.ingredient.id);
      expect(created.garnishes[0].garnishId).toBe(deps.garnish.id);
      expect(await prisma.auditLog.count({ where: { workspaceId: a.workspace.id, entityId: created.id, action: 'CREATE' } })).toBe(1);
    });

    it.each(['glassId', 'iceId', 'actionId', 'ingredientId', 'unitId', 'garnishId'] as const)(
      'rejects a foreign %s with 400 and writes nothing',
      async (field) => {
        const { a, b } = await seedTenantPair();
        const depsA = await seedRecipeDeps(a.workspace.id);
        const depsB = await seedRecipeDeps(b.workspace.id);
        const foreign = {
          glassId: { glass: depsB.glass },
          iceId: { ice: depsB.ice },
          actionId: { action: depsB.action },
          ingredientId: { ingredient: depsB.ingredient },
          unitId: { unit: depsB.unit },
          garnishId: { garnish: depsB.garnish },
        }[field];
        const before = await workspaceContentCounts(a.workspace.id);

        const result = await callAs(roleUser(a, 'OWNER'), collectionHandler, {
          method: 'POST',
          query: { workspaceId: a.workspace.id },
          body: cocktailBody({ ...depsA, ...foreign }),
        });

        expect(result.status).toBe(400);
        expect(errorCodeOf(result)).toBe('INVALID_REFERENCE');
        expect(await workspaceContentCounts(a.workspace.id)).toEqual(before);
      },
    );

    it('rejects non-raster images', async () => {
      const { a } = await seedTenantPair();
      const deps = await seedRecipeDeps(a.workspace.id);
      const result = await callAs(roleUser(a, 'MANAGER'), collectionHandler, {
        method: 'POST',
        query: { workspaceId: a.workspace.id },
        body: cocktailBody(deps, { image: SVG_DATA_URI }),
      });
      expect(result.status).toBe(400);
      expect(errorCodeOf(result)).toBe('VALIDATION_ERROR');
      expect(await prisma.cocktailRecipe.count()).toBe(0);
    });

    it('rejects unbounded input', async () => {
      const { a } = await seedTenantPair();
      const result = await callAs(roleUser(a, 'MANAGER'), collectionHandler, {
        method: 'POST',
        query: { workspaceId: a.workspace.id },
        body: { name: 'x'.repeat(256) },
      });
      expect(result.status).toBe(400);
    });
  });

  describe('update', () => {
    it('applies the differential update (update line, add line, drop step/garnish) and logs it', async () => {
      const { a } = await seedTenantPair();
      const deps = await seedRecipeDeps(a.workspace.id);
      const cocktail = await seedFullCocktail(a.workspace.id, deps);
      const [step0] = cocktail.steps;
      const line0 = step0.ingredients[0];

      const result = await callAs(roleUser(a, 'MANAGER'), itemHandler, {
        method: 'PUT',
        query: { workspaceId: a.workspace.id, cocktailId: cocktail.id },
        body: {
          name: 'Renamed',
          glassId: deps.glass.id,
          steps: [
            {
              id: step0.id,
              stepNumber: 0,
              actionId: deps.action.id,
              ingredients: [
                { id: line0.id, ingredientNumber: 0, amount: 9, unitId: deps.unit.id, ingredientId: deps.ingredient.id },
                { ingredientNumber: 1, amount: 1, unitId: null, ingredientId: deps.ingredient.id },
              ],
            },
          ],
          garnishes: [],
        },
      });

      expect(result.status).toBe(200);
      const after = await loadCocktail(cocktail.id);
      expect(after.name).toBe('Renamed');
      expect(after.iceId).toBeNull();
      expect(after.steps.map((s) => s.id)).toEqual([step0.id]);
      expect(after.steps[0].ingredients.map((l) => [l.id === line0.id, l.amount])).toEqual([
        [true, 9],
        [false, 1],
      ]);
      expect(after.garnishes).toHaveLength(0);
      expect(after.CocktailRecipeImage).toHaveLength(0);
      expect(await prisma.auditLog.count({ where: { entityId: cocktail.id, action: 'UPDATE' } })).toBe(1);
    });

    it('moves an ingredient line to another step of the same cocktail', async () => {
      const { a } = await seedTenantPair();
      const deps = await seedRecipeDeps(a.workspace.id);
      const cocktail = await seedFullCocktail(a.workspace.id, deps);
      const [step0, step1] = cocktail.steps;
      const movedLine = step0.ingredients[0];

      const result = await callAs(roleUser(a, 'MANAGER'), itemHandler, {
        method: 'PUT',
        query: { workspaceId: a.workspace.id, cocktailId: cocktail.id },
        body: {
          name: cocktail.name,
          steps: [
            {
              id: step1.id,
              stepNumber: 0,
              actionId: deps.action.id,
              ingredients: [
                { id: step1.ingredients[0].id, ingredientNumber: 0, amount: 1, ingredientId: deps.ingredient.id },
                { id: movedLine.id, ingredientNumber: 1, amount: 2, ingredientId: deps.ingredient.id },
              ],
            },
          ],
        },
      });

      expect(result.status).toBe(200);
      const after = await loadCocktail(cocktail.id);
      expect(after.steps.map((s) => s.id)).toEqual([step1.id]);
      expect(after.steps[0].ingredients.map((l) => l.id)).toEqual([step1.ingredients[0].id, movedLine.id]);
    });

    it.each(['step', 'line'] as const)("rejects another tenant's %s id in the body and leaves both cocktails unchanged", async (kind) => {
      const { a, b } = await seedTenantPair();
      const depsA = await seedRecipeDeps(a.workspace.id);
      const depsB = await seedRecipeDeps(b.workspace.id);
      const cocktailA = await seedFullCocktail(a.workspace.id, depsA);
      const cocktailB = await seedFullCocktail(b.workspace.id, depsB);
      const beforeA = await cocktailSnapshot(cocktailA.id);
      const beforeB = await cocktailSnapshot(cocktailB.id);

      const foreignStep = cocktailB.steps[0];
      const body = {
        name: 'Hijack',
        steps: [
          kind === 'step'
            ? { id: foreignStep.id, stepNumber: 99, actionId: depsA.action.id, ingredients: [] }
            : {
                id: cocktailA.steps[0].id,
                stepNumber: 0,
                actionId: depsA.action.id,
                ingredients: [{ id: foreignStep.ingredients[0].id, ingredientNumber: 0, amount: 999, ingredientId: depsA.ingredient.id }],
              },
        ],
      };

      for (const caller of [roleUser(a, 'OWNER'), 'master' as const]) {
        const result = await callAs(caller, itemHandler, {
          method: 'PUT',
          query: { workspaceId: a.workspace.id, cocktailId: cocktailA.id },
          body,
        });
        expect(result.status).toBe(400);
        expect(errorCodeOf(result)).toBe('INVALID_REFERENCE');
      }
      expect(await cocktailSnapshot(cocktailA.id)).toEqual(beforeA);
      expect(await cocktailSnapshot(cocktailB.id)).toEqual(beforeB);
    });

    it('rejects step ids of another cocktail in the same workspace', async () => {
      const { a } = await seedTenantPair();
      const deps = await seedRecipeDeps(a.workspace.id);
      const target = await seedFullCocktail(a.workspace.id, deps);
      const other = await seedFullCocktail(a.workspace.id, deps);
      const before = await cocktailSnapshot(other.id);

      const result = await callAs(roleUser(a, 'MANAGER'), itemHandler, {
        method: 'PUT',
        query: { workspaceId: a.workspace.id, cocktailId: target.id },
        body: { name: target.name, steps: [{ id: other.steps[0].id, stepNumber: 5, actionId: deps.action.id }] },
      });

      expect(result.status).toBe(400);
      expect(await cocktailSnapshot(other.id)).toEqual(before);
    });

    it("returns 404 for another tenant's cocktail and leaves it unchanged", async () => {
      const { a, b } = await seedTenantPair();
      const depsA = await seedRecipeDeps(a.workspace.id);
      const cocktailB = await seedFullCocktail(b.workspace.id, await seedRecipeDeps(b.workspace.id));
      const before = await cocktailSnapshot(cocktailB.id);

      const result = await callAs(roleUser(a, 'OWNER'), itemHandler, {
        method: 'PUT',
        query: { workspaceId: a.workspace.id, cocktailId: cocktailB.id },
        body: cocktailBody(depsA),
      });

      expect(result.status).toBe(404);
      expect(await cocktailSnapshot(cocktailB.id)).toEqual(before);
    });

    it('serializes concurrent updates of the same cocktail (no duplicated steps)', async () => {
      const { a } = await seedTenantPair();
      const deps = await seedRecipeDeps(a.workspace.id);
      const cocktail = await seedFullCocktail(a.workspace.id, deps);
      const manager = roleUser(a, 'MANAGER');

      const results = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          callAs(manager, itemHandler, {
            method: 'PUT',
            query: { workspaceId: a.workspace.id, cocktailId: cocktail.id },
            body: cocktailBody(deps, {
              name: `Concurrent ${i}`,
              steps: [0, 1, 2].map((stepNumber) => ({ stepNumber, actionId: deps.action.id, ingredients: [] })),
            }),
          }),
        ),
      );

      expect(results.map((r) => r.status)).toEqual(Array(10).fill(200));
      const after = await loadCocktail(cocktail.id);
      expect(after.steps.map((s) => s.stepNumber)).toEqual([0, 1, 2]);
      expect(after.garnishes).toHaveLength(1);
    });
  });

  describe('delete, archive, availability, clone, image', () => {
    it("returns 404 for another tenant's cocktail on every item operation and changes nothing", async () => {
      const { a, b } = await seedTenantPair();
      const cocktailB = await seedFullCocktail(b.workspace.id, await seedRecipeDeps(b.workspace.id));
      const before = await cocktailSnapshot(cocktailB.id);
      const owner = roleUser(a, 'OWNER');
      const query = { workspaceId: a.workspace.id, cocktailId: cocktailB.id };

      const calls = [
        callAs(owner, itemHandler, { method: 'GET', query }),
        callAs(owner, itemHandler, { method: 'DELETE', query }),
        callAs(owner, archiveHandler, { method: 'PUT', query }),
        callAs(owner, unarchiveHandler, { method: 'PUT', query }),
        callAs(owner, availabilityHandler, { method: 'PUT', query, body: { unavailable: true } }),
        callAs(owner, cloneHandler, { method: 'POST', query, body: { name: 'Stolen' } }),
        callAs(owner, imageHandler, { method: 'GET', query }),
      ];
      for (const result of await Promise.all(calls)) expect(result.status).toBe(404);

      expect(await cocktailSnapshot(cocktailB.id)).toEqual(before);
      expect(await prisma.cocktailRecipe.count({ where: { workspaceId: a.workspace.id } })).toBe(0);
      expect(await prisma.auditLog.count({ where: { workspaceId: a.workspace.id } })).toBe(0);
    });

    it('archives, unarchives and toggles availability with audit entries', async () => {
      const { a } = await seedTenantPair();
      const cocktail = await seedFullCocktail(a.workspace.id, await seedRecipeDeps(a.workspace.id));
      const query = { workspaceId: a.workspace.id, cocktailId: cocktail.id };

      expect(dataOf<CocktailDto>(await callAs(roleUser(a, 'MANAGER'), archiveHandler, { method: 'PUT', query })).isArchived).toBe(true);
      expect(dataOf<CocktailDto>(await callAs(roleUser(a, 'MANAGER'), unarchiveHandler, { method: 'PUT', query })).isArchived).toBe(false);
      const unavailable = await callAs(roleUser(a, 'USER'), availabilityHandler, { method: 'PUT', query, body: { unavailable: true } });
      expect(dataOf<CocktailDto>(unavailable).unavailableUntil).not.toBeNull();

      const logs = await prisma.auditLog.findMany({ where: { entityId: cocktail.id }, orderBy: { createdAt: 'asc' } });
      expect(logs.map((log) => log.action)).toEqual(['UPDATE', 'UPDATE', 'UPDATE']);
      expect(logs.every((log) => log.entityType === 'CocktailRecipe')).toBe(true);
    });

    it('deletes an own cocktail with an audit entry', async () => {
      const { a } = await seedTenantPair();
      const cocktail = await seedFullCocktail(a.workspace.id, await seedRecipeDeps(a.workspace.id));
      const result = await callAs(roleUser(a, 'ADMIN'), itemHandler, { method: 'DELETE', query: { workspaceId: a.workspace.id, cocktailId: cocktail.id } });
      expect(result.status).toBe(200);
      expect(await prisma.cocktailRecipe.count()).toBe(0);
      expect(await prisma.auditLog.count({ where: { entityId: cocktail.id, action: 'DELETE' } })).toBe(1);
    });

    it('deep-clones a cocktail (incl. unit-less lines and alternative garnishes)', async () => {
      const { a } = await seedTenantPair();
      const deps = await seedRecipeDeps(a.workspace.id);
      const cocktail = await seedFullCocktail(a.workspace.id, deps);
      await prisma.cocktailRecipeIngredient.create({
        data: { cocktailRecipeStepId: cocktail.steps[0].id, ingredientNumber: 1, unitId: null, ingredientId: null },
      });

      const result = await callAs(roleUser(a, 'MANAGER'), cloneHandler, {
        method: 'POST',
        query: { workspaceId: a.workspace.id, cocktailId: cocktail.id },
        body: { name: 'Clone' },
      });

      expect(result.status).toBe(200);
      const clone = await loadCocktail(dataOf<CocktailDto>(result).id);
      expect(clone.name).toBe('Clone');
      expect(clone.steps.map((s) => s.ingredients.length)).toEqual([2, 1]);
      expect(clone.garnishes[0].isAlternative).toBe(true);
      expect(clone.CocktailRecipeImage).toHaveLength(1);
      expect(await prisma.auditLog.count({ where: { entityId: clone.id, action: 'CREATE' } })).toBe(1);
    });

    it('serves the image with nosniff and a sandbox CSP', async () => {
      const { a } = await seedTenantPair();
      const cocktail = await seedFullCocktail(a.workspace.id, await seedRecipeDeps(a.workspace.id));
      const result = await callAs(roleUser(a, 'USER'), imageHandler, { method: 'GET', query: { workspaceId: a.workspace.id, cocktailId: cocktail.id } });
      expect(result.status).toBe(200);
      expect(result.headers['Content-Type']).toBe('image/png');
      expect(result.headers['X-Content-Type-Options']).toBe('nosniff');
      expect(String(result.headers['Content-Security-Policy'])).toContain('sandbox');
    });
  });

  describe('export', () => {
    it('requires COCKTAILS_READ for API keys', async () => {
      const { a } = await seedTenantPair();
      const cocktail = await seedFullCocktail(a.workspace.id, await seedRecipeDeps(a.workspace.id));
      const owner = roleUser(a, 'OWNER');
      const withoutScope = await seedApiKey(a.workspace.id, owner.user.id, ['GLASSES_READ']);
      const withScope = await seedApiKey(a.workspace.id, owner.user.id, ['COCKTAILS_READ']);
      const options = { method: 'POST', query: { workspaceId: a.workspace.id }, body: { cocktailIds: [cocktail.id] } };

      expect((await callAs({ apiKeyJwt: withoutScope.jwt }, exportJsonHandler, options)).status).toBe(403);
      expect((await callAs({ apiKeyJwt: withScope.jwt }, exportJsonHandler, options)).status).toBe(200);
    });

    it("never exports another tenant's cocktails or dependencies", async () => {
      const { a, b } = await seedTenantPair();
      const depsA = await seedRecipeDeps(a.workspace.id);
      const depsB = await seedRecipeDeps(b.workspace.id);
      const cocktailA = await seedFullCocktail(a.workspace.id, depsA);
      const cocktailB = await seedFullCocktail(b.workspace.id, depsB);
      // Legacy corruption: A's cocktail points at B's glass and B's action.
      await prisma.cocktailRecipe.update({ where: { id: cocktailA.id }, data: { glassId: depsB.glass.id } });
      await prisma.cocktailRecipeStep.update({ where: { id: cocktailA.steps[0].id }, data: { actionId: depsB.action.id } });

      const onlyB = await callAs(roleUser(a, 'OWNER'), exportJsonHandler, {
        method: 'POST',
        query: { workspaceId: a.workspace.id },
        body: { cocktailIds: [cocktailB.id] },
      });
      expect(onlyB.status).toBe(404);

      const mixed = await callAs('master', exportJsonHandler, {
        method: 'POST',
        query: { workspaceId: a.workspace.id },
        body: { cocktailIds: [cocktailA.id, cocktailB.id] },
      });
      expect(mixed.status).toBe(200);
      const dump = JSON.stringify(mixed.json);
      for (const foreignId of [cocktailB.id, depsB.glass.id, depsB.action.id, depsB.ingredient.id, depsB.unit.id, depsB.garnish.id]) {
        expect(dump).not.toContain(foreignId);
      }
      expect(dump).toContain(depsA.ingredient.id);
    });

    it('escapes user content in the PDF HTML', async () => {
      const { a } = await seedTenantPair();
      const payload = '"><img src=x onerror=alert(1)><script>alert(2)</script>';
      const cocktail = await seedFullCocktail(a.workspace.id, await seedRecipeDeps(a.workspace.id), payload);
      const full = await prisma.cocktailRecipe.findUniqueOrThrow({
        where: { id: cocktail.id },
        include: {
          _count: { select: { CocktailRecipeImage: true } },
          CocktailRecipeImage: { select: { image: true } },
          ice: true,
          glass: { include: { _count: { select: { GlassImage: true } } } },
          garnishes: { include: { garnish: { include: { _count: { select: { GarnishImage: true } } } } } },
          steps: {
            include: { action: true, ingredients: { include: { ingredient: { include: { _count: { select: { IngredientImage: true } } } }, unit: true } } },
          },
          ratings: true,
        },
      });

      const html = generateHtmlForCocktails(
        [full],
        {},
        {
          exportImage: true,
          exportDescription: true,
          exportNotes: true,
          exportHistory: true,
          newPagePerCocktail: true,
          showHeader: false,
          showFooter: false,
          locale: 'de',
          contentLocales: { primary: 'de', additional: [] },
        },
      );

      expect(html).not.toContain(payload);
      expect(html).not.toContain('<script>alert(2)');
      expect(html).not.toContain('<img src=x');
      expect(html).toContain('data-cocktail-name="&quot;&gt;&lt;img');
    });

    it('validates the PDF export body (max. 200 ids) and scopes ids', async () => {
      const { a, b } = await seedTenantPair();
      const cocktailB = await seedFullCocktail(b.workspace.id, await seedRecipeDeps(b.workspace.id));
      const owner = roleUser(a, 'OWNER');
      const tooMany = await callAs(owner, exportPdfHandler, {
        method: 'POST',
        query: { workspaceId: a.workspace.id },
        body: { cocktailIds: Array.from({ length: 201 }, (_, i) => `id${i}`) },
      });
      expect(tooMany.status).toBe(400);

      const foreign = await callAs(owner, exportPdfHandler, { method: 'POST', query: { workspaceId: a.workspace.id }, body: { cocktailIds: [cocktailB.id] } });
      expect(foreign.status).toBe(404);
    });
  });
});
