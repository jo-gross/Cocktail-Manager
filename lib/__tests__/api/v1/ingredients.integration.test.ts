import { describe, it, expect } from 'vitest';
import {
  checkHandler,
  cloneHandler,
  collectionHandler,
  exportJsonHandler,
  imageHandler,
  importJsonHandler,
  itemHandler,
  referencesHandler,
} from '@lib/api/v1/ingredients';
import { invokeHandler } from '@test/helpers/invokeHandler';
import { sessionCookie } from '@test/helpers/authFixtures';
import { findUserByRole, seedApiKey, seedWorkspace } from '@test/helpers/dbFixtures';
import { callAs, dataOf, errorCodeOf, roleUser, seedTenantPair } from '@test/helpers/scenario';
import {
  PNG_DATA_URI,
  SVG_DATA_URI,
  decision,
  ingredientExportItem,
  openTransaction,
  seedCocktailWithStep,
  seedIngredientWithVolume,
  seedUnit,
} from '@test/helpers/fixtures/g1';
import { IngredientDtoSchema } from '@lib/schemas/ingredients';
import prisma from '../../../../prisma/prisma';

describe('ingredients v1 integration', () => {
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
      body: { name: 'Rum' },
      headers: sessionCookie(user.sessionToken),
    });
    expect(result.status).toBe(403);
  });

  it('creates, reads and deletes an ingredient', async () => {
    const seeded = await setup();
    const manager = findUserByRole(seeded, 'MANAGER');
    const admin = findUserByRole(seeded, 'ADMIN');

    const createResult = await invokeHandler(collectionHandler, {
      method: 'POST',
      query: { workspaceId: seeded.workspace.id },
      body: { name: 'Rum', price: 12.5 },
      headers: sessionCookie(manager.sessionToken),
    });
    expect(createResult.status).toBe(200);
    const created = (createResult.json as { data: unknown }).data;
    expect(IngredientDtoSchema.safeParse(created).success).toBe(true);
    const ingredientId = (created as { id: string }).id;

    const getResult = await invokeHandler(itemHandler, {
      method: 'GET',
      query: { workspaceId: seeded.workspace.id, ingredientId },
      headers: sessionCookie(findUserByRole(seeded, 'USER').sessionToken),
    });
    expect(getResult.status).toBe(200);

    const deleteResult = await invokeHandler(itemHandler, {
      method: 'DELETE',
      query: { workspaceId: seeded.workspace.id, ingredientId },
      headers: sessionCookie(admin.sessionToken),
    });
    expect(deleteResult.status).toBe(200);
  });

  describe('volumes and images', () => {
    it('creates with volumes and an image, keeps volumes when an update omits them, replaces them when given', async () => {
      const { a } = await seedTenantPair();
      const cl = await seedUnit(a.workspace.id, 'cl');
      const ml = await seedUnit(a.workspace.id, 'ml');
      const manager = roleUser(a, 'MANAGER');
      const query = { workspaceId: a.workspace.id };

      const created = await callAs(manager, collectionHandler, {
        method: 'POST',
        query,
        body: { name: 'Gin', units: [{ unitId: cl.id, volume: 70 }], image: PNG_DATA_URI },
      });
      expect(created.status).toBe(200);
      const ingredient = dataOf<{ id: string; hasImage: boolean; volumes: Array<{ unit: { id: string } }> }>(created);
      expect(ingredient.hasImage).toBe(true);
      expect(ingredient.volumes.map((v) => v.unit.id)).toEqual([cl.id]);

      const image = await callAs(roleUser(a, 'USER'), imageHandler, { method: 'GET', query: { ...query, ingredientId: ingredient.id } });
      expect(image.status).toBe(200);
      expect(image.headers['X-Content-Type-Options']).toBe('nosniff');

      const keep = await callAs(manager, itemHandler, { method: 'PUT', query: { ...query, ingredientId: ingredient.id }, body: { name: 'Gin 2' } });
      expect(keep.status).toBe(200);
      expect(await prisma.ingredientVolume.count({ where: { ingredientId: ingredient.id } })).toBe(1);

      const replace = await callAs(manager, itemHandler, {
        method: 'PUT',
        query: { ...query, ingredientId: ingredient.id },
        body: { name: 'Gin 2', units: [{ unitId: ml.id, volume: 700 }] },
      });
      expect(replace.status).toBe(200);
      expect(dataOf<{ volumes: Array<{ unit: { id: string }; volume: number }> }>(replace).volumes).toEqual([
        expect.objectContaining({ volume: 700, unit: expect.objectContaining({ id: ml.id }) }),
      ]);
    });

    it('rejects duplicate units and non-raster images', async () => {
      const { a } = await seedTenantPair();
      const cl = await seedUnit(a.workspace.id, 'cl');
      const manager = roleUser(a, 'MANAGER');
      const query = { workspaceId: a.workspace.id };

      const duplicate = await callAs(manager, collectionHandler, {
        method: 'POST',
        query,
        body: {
          name: 'Gin',
          units: [
            { unitId: cl.id, volume: 1 },
            { unitId: cl.id, volume: 2 },
          ],
        },
      });
      expect(duplicate.status).toBe(400);
      expect((await callAs(manager, collectionHandler, { method: 'POST', query, body: { name: 'Gin', image: SVG_DATA_URI } })).status).toBe(400);
      expect(await prisma.ingredient.count({ where: { workspaceId: a.workspace.id } })).toBe(0);
    });

    it('check requires name or link', async () => {
      const { a } = await seedTenantPair();
      const result = await callAs(roleUser(a, 'USER'), checkHandler, { method: 'GET', query: { workspaceId: a.workspace.id } });
      expect(result.status).toBe(400);
    });
  });

  describe('tenant isolation', () => {
    it('rejects units of another workspace on create and update without writing anything', async () => {
      const { a, b } = await seedTenantPair();
      const foreignUnit = await seedUnit(b.workspace.id, 'B unit');
      const ownUnit = await seedUnit(a.workspace.id, 'cl');
      const own = await seedIngredientWithVolume(a.workspace.id, ownUnit.id, 'Own');
      const manager = roleUser(a, 'MANAGER');
      const query = { workspaceId: a.workspace.id };

      const create = await callAs(manager, collectionHandler, { method: 'POST', query, body: { name: 'Rum', units: [{ unitId: foreignUnit.id, volume: 1 }] } });
      expect(create.status).toBe(400);
      expect(errorCodeOf(create)).toBe('INVALID_REFERENCE');

      const update = await callAs(manager, itemHandler, {
        method: 'PUT',
        query: { ...query, ingredientId: own.id },
        body: { name: 'Changed', units: [{ unitId: foreignUnit.id, volume: 1 }] },
      });
      expect(update.status).toBe(400);
      expect(errorCodeOf(update)).toBe('INVALID_REFERENCE');

      expect(await prisma.ingredient.count({ where: { workspaceId: a.workspace.id } })).toBe(1);
      const after = await prisma.ingredient.findUniqueOrThrow({ where: { id: own.id }, include: { IngredientVolume: true, IngredientImage: true } });
      expect(after.name).toBe('Own');
      expect(after.IngredientVolume.map((v) => v.unitId)).toEqual([ownUnit.id]);
      expect(after.IngredientImage).toHaveLength(1);
      expect(await prisma.ingredientVolume.count({ where: { unitId: foreignUnit.id } })).toBe(0);
    });

    it("rejects an update of another workspace's ingredient and leaves its volumes and image intact", async () => {
      const { a, b } = await seedTenantPair();
      const foreignUnit = await seedUnit(b.workspace.id, 'B unit');
      const foreign = await seedIngredientWithVolume(b.workspace.id, foreignUnit.id, 'B Rum');

      const result = await callAs(roleUser(a, 'MANAGER'), itemHandler, {
        method: 'PUT',
        query: { workspaceId: a.workspace.id, ingredientId: foreign.id },
        body: { name: 'Stolen', units: [] },
      });

      expect(result.status).toBe(404);
      const after = await prisma.ingredient.findUniqueOrThrow({ where: { id: foreign.id }, include: { IngredientVolume: true, IngredientImage: true } });
      expect(after).toMatchObject({ name: 'B Rum', workspaceId: b.workspace.id });
      expect(after.IngredientVolume).toHaveLength(1);
      expect(after.IngredientImage).toHaveLength(1);
    });

    it("returns 404 for another workspace's ingredient on delete, clone, references and image", async () => {
      const { a, b } = await seedTenantPair();
      const foreignUnit = await seedUnit(b.workspace.id);
      const foreign = await seedIngredientWithVolume(b.workspace.id, foreignUnit.id, 'B Rum');
      const query = { workspaceId: a.workspace.id, ingredientId: foreign.id };
      const owner = roleUser(a, 'OWNER');

      expect((await callAs(owner, itemHandler, { method: 'DELETE', query })).status).toBe(404);
      expect((await callAs('master', itemHandler, { method: 'DELETE', query })).status).toBe(404);
      expect((await callAs(owner, cloneHandler, { method: 'POST', query, body: { name: 'Copy' } })).status).toBe(404);
      expect((await callAs(owner, referencesHandler, { method: 'GET', query })).status).toBe(404);
      expect((await callAs(owner, imageHandler, { method: 'GET', query })).status).toBe(404);

      expect(await prisma.ingredient.findUnique({ where: { id: foreign.id } })).not.toBeNull();
      expect(await prisma.ingredient.count({ where: { workspaceId: a.workspace.id } })).toBe(0);
    });

    it("rejects an import that overwrites another workspace's ingredient and writes nothing", async () => {
      const { a, b } = await seedTenantPair();
      const foreignUnit = await seedUnit(b.workspace.id, 'B unit');
      const foreign = await seedIngredientWithVolume(b.workspace.id, foreignUnit.id, 'B Rum');

      const result = await callAs(roleUser(a, 'MANAGER'), importJsonHandler, {
        method: 'POST',
        query: { workspaceId: a.workspace.id },
        body: {
          phase: 'execute',
          decisions: [
            decision(ingredientExportItem('New', [{ name: 'cl', volume: 70 }])),
            decision(ingredientExportItem('B Rum'), { decision: 'overwrite', existingId: foreign.id }),
          ],
        },
      });

      expect(result.status).toBe(400);
      expect(errorCodeOf(result)).toBe('INVALID_REFERENCE');
      const after = await prisma.ingredient.findUniqueOrThrow({ where: { id: foreign.id }, include: { IngredientVolume: true } });
      expect(after.name).toBe('B Rum');
      expect(after.IngredientVolume).toHaveLength(1);
      expect(await prisma.ingredient.count({ where: { workspaceId: a.workspace.id } })).toBe(0);
      expect(await prisma.unit.count({ where: { workspaceId: a.workspace.id } })).toBe(0);
    });
  });

  describe('authorization', () => {
    it('denies writes to an API key with only INGREDIENTS_READ', async () => {
      const { a } = await seedTenantPair();
      const key = await seedApiKey(a.workspace.id, roleUser(a, 'OWNER').user.id, ['INGREDIENTS_READ']);
      const unit = await seedUnit(a.workspace.id);
      const ingredient = await seedIngredientWithVolume(a.workspace.id, unit.id, 'Rum');
      const query = { workspaceId: a.workspace.id };
      const caller = { apiKeyJwt: key.jwt };

      expect((await callAs(caller, collectionHandler, { method: 'POST', query, body: { name: 'X' } })).status).toBe(403);
      expect((await callAs(caller, itemHandler, { method: 'PUT', query: { ...query, ingredientId: ingredient.id }, body: { name: 'X' } })).status).toBe(403);
      expect((await callAs(caller, cloneHandler, { method: 'POST', query: { ...query, ingredientId: ingredient.id }, body: { name: 'X' } })).status).toBe(403);
      expect((await callAs(caller, itemHandler, { method: 'GET', query: { ...query, ingredientId: ingredient.id } })).status).toBe(200);
      expect(await prisma.ingredient.count({ where: { workspaceId: a.workspace.id } })).toBe(1);
    });
  });

  describe('import (all-or-nothing)', () => {
    it('writes nothing when a volume references a unit missing from the export', async () => {
      const { a } = await seedTenantPair();
      const broken = ingredientExportItem('Broken', [{ name: 'cl', volume: 70 }]);
      broken.units = [];

      const result = await callAs(roleUser(a, 'MANAGER'), importJsonHandler, {
        method: 'POST',
        query: { workspaceId: a.workspace.id },
        body: { phase: 'execute', decisions: [decision(ingredientExportItem('Valid', [{ name: 'cl', volume: 4 }])), decision(broken)] },
      });

      expect(result.status).toBe(400);
      expect(errorCodeOf(result)).toBe('INVALID_IMPORT_ITEMS');
      expect((result.json as { error: { issues: Array<{ index: number; name: string }> } }).error.issues).toMatchObject([{ index: 1, name: 'Broken' }]);
      expect(await prisma.ingredient.count({ where: { workspaceId: a.workspace.id } })).toBe(0);
      expect(await prisma.unit.count({ where: { workspaceId: a.workspace.id } })).toBe(0);
    });

    it('imports volumes by unit name (reusing existing units) and overwrites with real old data in the audit log', async () => {
      const { a } = await seedTenantPair();
      const cl = await seedUnit(a.workspace.id, 'cl');
      const existing = await seedIngredientWithVolume(a.workspace.id, cl.id, 'Rum');

      const result = await callAs(roleUser(a, 'MANAGER'), importJsonHandler, {
        method: 'POST',
        query: { workspaceId: a.workspace.id },
        body: {
          phase: 'execute',
          decisions: [
            decision(ingredientExportItem('Rum', [{ name: 'Flasche', volume: 1 }], { price: 30 }), { decision: 'overwrite', existingId: existing.id }),
            decision(
              ingredientExportItem('Gin', [
                { name: 'cl', volume: 70 },
                { name: 'Flasche', volume: 1 },
              ]),
            ),
          ],
        },
      });

      expect(result.status).toBe(200);
      expect(result.json).toEqual({
        success: true,
        results: [
          { name: 'Rum', status: 'overwritten' },
          { name: 'Gin', status: 'created' },
        ],
      });
      const units = await prisma.unit.findMany({ where: { workspaceId: a.workspace.id }, orderBy: { name: 'asc' } });
      expect(units.map((u) => u.name)).toEqual(['Flasche', 'cl']);
      const rum = await prisma.ingredient.findUniqueOrThrow({
        where: { id: existing.id },
        include: { IngredientVolume: { include: { unit: true } }, IngredientImage: true },
      });
      expect(rum).toMatchObject({ price: 30, abv: 40 });
      expect(rum.IngredientVolume.map((v) => v.unit.name)).toEqual(['Flasche']);
      expect(rum.IngredientImage).toHaveLength(1);

      const updateLog = await prisma.auditLog.findFirstOrThrow({ where: { workspaceId: a.workspace.id, entityId: existing.id, action: 'UPDATE' } });
      expect(updateLog.changes).not.toBeNull();
    });

    it('round-trips its own export', async () => {
      const { a, b } = await seedTenantPair();
      const unit = await seedUnit(a.workspace.id, 'cl');
      const ingredient = await seedIngredientWithVolume(a.workspace.id, unit.id, 'Vermouth');

      const exported = await callAs(roleUser(a, 'USER'), exportJsonHandler, {
        method: 'POST',
        query: { workspaceId: a.workspace.id },
        body: { ids: [ingredient.id] },
      });
      expect(exported.status).toBe(200);

      const imported = await callAs(roleUser(b, 'MANAGER'), importJsonHandler, {
        method: 'POST',
        query: { workspaceId: b.workspace.id },
        body: { phase: 'execute', decisions: [decision(exported.json as { ingredient: { name: string } })] },
      });
      expect(imported.status).toBe(200);
      const copy = await prisma.ingredient.findFirstOrThrow({
        where: { workspaceId: b.workspace.id, name: 'Vermouth' },
        include: { IngredientVolume: { include: { unit: true } } },
      });
      expect(copy.IngredientVolume).toMatchObject([{ volume: 70, unit: { name: 'cl', workspaceId: b.workspace.id } }]);
    });
  });

  describe('delete and references', () => {
    it('lists references and rejects deleting an ingredient in use', async () => {
      const { a } = await seedTenantPair();
      const unit = await seedUnit(a.workspace.id);
      const ingredient = await seedIngredientWithVolume(a.workspace.id, unit.id);
      const cocktail = await seedCocktailWithStep(a.workspace.id);
      await prisma.cocktailRecipeIngredient.create({
        data: { cocktailRecipeStepId: cocktail.steps[0]!.id, ingredientId: ingredient.id, ingredientNumber: 0, amount: 4 },
      });
      const query = { workspaceId: a.workspace.id, ingredientId: ingredient.id };

      const references = await callAs(roleUser(a, 'USER'), referencesHandler, { method: 'GET', query });
      expect(dataOf(references)).toEqual([{ id: cocktail.id, name: cocktail.name }]);

      const result = await callAs(roleUser(a, 'ADMIN'), itemHandler, { method: 'DELETE', query });
      expect(result.status).toBe(409);
      expect(errorCodeOf(result)).toBe('INGREDIENT_IN_USE');
      expect(await prisma.cocktailRecipeIngredient.count({ where: { ingredientId: ingredient.id } })).toBe(1);
    });

    it('never deletes recipe lines that are saved while the ingredient is being deleted', async () => {
      const { a } = await seedTenantPair();
      const unit = await seedUnit(a.workspace.id);
      const ingredient = await seedIngredientWithVolume(a.workspace.id, unit.id);
      const cocktail = await seedCocktailWithStep(a.workspace.id);
      const stepId = cocktail.steps[0]!.id;

      const [deleteResult, ...inserts] = await Promise.all([
        callAs(roleUser(a, 'ADMIN'), itemHandler, { method: 'DELETE', query: { workspaceId: a.workspace.id, ingredientId: ingredient.id } }),
        ...Array.from({ length: 10 }, (_, i) =>
          prisma.cocktailRecipeIngredient.create({ data: { cocktailRecipeStepId: stepId, ingredientId: ingredient.id, ingredientNumber: i, amount: 1 } }).then(
            () => 'created' as const,
            () => 'failed' as const,
          ),
        ),
      ]);

      const created = inserts.filter((r) => r === 'created').length;
      expect(await prisma.cocktailRecipeIngredient.count({ where: { cocktailRecipeStepId: stepId } })).toBe(created);
      if (deleteResult.status === 200) expect(created).toBe(0);
      else expect(deleteResult.status).toBe(409);
    });

    it('waits for an uncommitted recipe line and then refuses the delete instead of cascading it away', async () => {
      const { a } = await seedTenantPair();
      const unit = await seedUnit(a.workspace.id);
      const ingredient = await seedIngredientWithVolume(a.workspace.id, unit.id);
      const cocktail = await seedCocktailWithStep(a.workspace.id);
      const stepId = cocktail.steps[0]!.id;

      const pending = await openTransaction((tx) =>
        tx.cocktailRecipeIngredient.create({ data: { cocktailRecipeStepId: stepId, ingredientId: ingredient.id, ingredientNumber: 0, amount: 1 } }),
      );
      const deleting = callAs(roleUser(a, 'ADMIN'), itemHandler, { method: 'DELETE', query: { workspaceId: a.workspace.id, ingredientId: ingredient.id } });
      await new Promise((resolve) => setTimeout(resolve, 300));
      pending.commit();
      await pending.done;
      const result = await deleting;

      expect(result.status).toBe(409);
      expect(await prisma.cocktailRecipeIngredient.count({ where: { cocktailRecipeStepId: stepId } })).toBe(1);
    });

    it('clone copies volumes and writes an audit log', async () => {
      const { a } = await seedTenantPair();
      const unit = await seedUnit(a.workspace.id, 'cl');
      const ingredient = await seedIngredientWithVolume(a.workspace.id, unit.id, 'Rum');

      const result = await callAs(roleUser(a, 'MANAGER'), cloneHandler, {
        method: 'POST',
        query: { workspaceId: a.workspace.id, ingredientId: ingredient.id },
        body: { name: 'Rum Copy' },
      });

      expect(result.status).toBe(200);
      const clone = dataOf<{ id: string; hasImage: boolean; volumes: unknown[] }>(result);
      expect(clone.hasImage).toBe(true);
      expect(clone.volumes).toHaveLength(1);
      expect(await prisma.auditLog.count({ where: { workspaceId: a.workspace.id, entityType: 'Ingredient', entityId: clone.id, action: 'CREATE' } })).toBe(1);
    });
  });
});
