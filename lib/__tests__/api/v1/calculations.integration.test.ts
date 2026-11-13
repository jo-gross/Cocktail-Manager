import { describe, it, expect } from 'vitest';
import prisma from '../../../../prisma/prisma';
import { collectionHandler, itemHandler, groupsItemHandler, groupsAssignHandler, importJsonHandler, exportJsonHandler } from '@lib/api/v1/calculations';
import { callAs, dataOf, errorCodeOf, roleUser, seedTenantPair } from '@test/helpers/scenario';
import { seedApiKey } from '@test/helpers/dbFixtures';
import { calculationExportItem, seedCalculation, seedCalculationGroup, seedContent, seedUnit } from '@test/helpers/fixtures/g3';

async function setup() {
  const pair = await seedTenantPair();
  const contentA = await seedContent(pair.a.workspace.id);
  const contentB = await seedContent(pair.b.workspace.id);
  const ownerB = roleUser(pair.b, 'OWNER').user;
  const calcB = await seedCalculation(pair.b.workspace.id, ownerB.id, {
    cocktailId: contentB.cocktail.id,
    ingredientId: contentB.ingredient.id,
    unitId: contentB.unit.id,
  });
  return { ...pair, contentA, contentB, calcB };
}

function calcBody(content: { cocktail: { id: string }; ingredient: { id: string }; unit: { id: string } }, name = 'Party') {
  return {
    name,
    showSalesStuff: true,
    calculationItems: [{ cocktailId: content.cocktail.id, plannedAmount: 20, customPrice: 8 }],
    ingredientShoppingUnits: [{ ingredientId: content.ingredient.id, unitId: content.unit.id, checked: false }],
  };
}

/** Rows of a calculation incl. children, to assert "unchanged". */
async function calculationState(id: string) {
  return prisma.cocktailCalculation.findUnique({
    where: { id },
    include: { cocktailCalculationItems: { orderBy: { cocktailId: 'asc' } }, ingredientShoppingUnits: { orderBy: { ingredientId: 'asc' } } },
  });
}

describe('calculations v1 integration', () => {
  it('creates, updates and deletes a calculation with audit logs', async () => {
    const { a, contentA } = await setup();
    const user = roleUser(a, 'USER');
    const query = { workspaceId: a.workspace.id };

    const created = await callAs(user, collectionHandler, { method: 'POST', query, body: calcBody(contentA) });
    expect(created.status).toBe(200);
    const id = dataOf<{ id: string }>(created).id;

    const otherCocktail = await prisma.cocktailRecipe.create({ data: { name: 'Second', workspaceId: a.workspace.id } });
    const updated = await callAs(user, itemHandler, {
      method: 'PUT',
      query: { ...query, calculationId: id },
      body: { ...calcBody(contentA, 'Party 2'), calculationItems: [{ cocktailId: otherCocktail.id, plannedAmount: 3 }] },
    });
    expect(updated.status).toBe(200);
    expect(dataOf<{ name: string; items: Array<{ cocktail: { id: string } }> }>(updated)).toMatchObject({
      name: 'Party 2',
      items: [{ cocktail: { id: otherCocktail.id } }],
    });

    const removed = await callAs(roleUser(a, 'ADMIN'), itemHandler, { method: 'DELETE', query: { ...query, calculationId: id } });
    expect(removed.status).toBe(200);
    expect(await prisma.cocktailCalculation.count({ where: { id } })).toBe(0);

    const logs = await prisma.auditLog.findMany({ where: { entityId: id }, orderBy: { createdAt: 'asc' } });
    expect(logs.map((log) => log.action)).toEqual(['CREATE', 'UPDATE', 'DELETE']);
    expect(logs[1].changes).not.toBeNull();
  });

  it('rejects updating, reading and deleting another workspace’s calculation (404) and leaves it unchanged', async () => {
    const { a, contentA, calcB } = await setup();
    const before = await calculationState(calcB.id);
    const query = { workspaceId: a.workspace.id, calculationId: calcB.id };

    const put = await callAs(roleUser(a, 'USER'), itemHandler, { method: 'PUT', query, body: calcBody(contentA, 'Hijacked') });
    expect(put.status).toBe(404);
    const get = await callAs(roleUser(a, 'USER'), itemHandler, { method: 'GET', query });
    expect(get.status).toBe(404);
    const del = await callAs(roleUser(a, 'OWNER'), itemHandler, { method: 'DELETE', query });
    expect(del.status).toBe(404);
    const masterPut = await callAs('master', itemHandler, { method: 'PUT', query, body: calcBody(contentA, 'Hijacked') });
    expect(masterPut.status).toBe(404);

    expect(await calculationState(calcB.id)).toEqual(before);
  });

  it('rejects foreign cocktail/ingredient/unit/group ids in the body (400) without writing', async () => {
    const { a, b, contentA, contentB } = await setup();
    const user = roleUser(a, 'USER');
    const query = { workspaceId: a.workspace.id };

    const foreignCocktail = await callAs(user, collectionHandler, {
      method: 'POST',
      query,
      body: { ...calcBody(contentA), calculationItems: [{ cocktailId: contentB.cocktail.id, plannedAmount: 1 }] },
    });
    expect(foreignCocktail.status).toBe(400);
    expect(errorCodeOf(foreignCocktail)).toBe('INVALID_REFERENCE');

    const groupB = await seedCalculationGroup(b.workspace.id);
    const foreignGroup = await callAs(user, collectionHandler, { method: 'POST', query, body: { ...calcBody(contentA), groupId: groupB.id } });
    expect(foreignGroup.status).toBe(400);
    expect(errorCodeOf(foreignGroup)).toBe('INVALID_GROUP');
    expect(await prisma.cocktailCalculation.count({ where: { workspaceId: a.workspace.id } })).toBe(0);

    const calcA = await seedCalculation(a.workspace.id, user.user.id, {
      cocktailId: contentA.cocktail.id,
      ingredientId: contentA.ingredient.id,
      unitId: contentA.unit.id,
    });
    const beforeA = await calculationState(calcA.id);
    const foreignUnit = await callAs(user, itemHandler, {
      method: 'PUT',
      query: { ...query, calculationId: calcA.id },
      body: { ...calcBody(contentA), ingredientShoppingUnits: [{ ingredientId: contentA.ingredient.id, unitId: contentB.unit.id, checked: true }] },
    });
    expect(foreignUnit.status).toBe(400);
    expect(await calculationState(calcA.id)).toEqual(beforeA);
  });

  it('rejects the master key on calculation writes (403) instead of failing on the user FK', async () => {
    const { a, contentA } = await setup();
    const result = await callAs('master', collectionHandler, { method: 'POST', query: { workspaceId: a.workspace.id }, body: calcBody(contentA) });
    expect(result.status).toBe(403);
    expect(errorCodeOf(result)).toBe('MASTER_KEY_NOT_ALLOWED');
    expect(await prisma.cocktailCalculation.count()).toBe(1);
  });

  it('scopes group update/delete/assign to the workspace', async () => {
    const { a, b, calcB } = await setup();
    const user = roleUser(a, 'USER');
    const groupB = await seedCalculationGroup(b.workspace.id, 'B group');

    const put = await callAs(user, groupsItemHandler, {
      method: 'PUT',
      query: { workspaceId: a.workspace.id, groupId: groupB.id },
      body: { name: 'Hijacked' },
    });
    expect(put.status).toBe(404);
    const del = await callAs(user, groupsItemHandler, { method: 'DELETE', query: { workspaceId: a.workspace.id, groupId: groupB.id } });
    expect(del.status).toBe(404);
    expect(await prisma.cocktailCalculationGroup.findUnique({ where: { id: groupB.id } })).toMatchObject({ name: 'B group' });

    const assign = await callAs(user, groupsAssignHandler, {
      method: 'POST',
      query: { workspaceId: a.workspace.id },
      body: { calculationIds: [calcB.id], groupId: null },
    });
    expect(assign.status).toBe(400);
  });

  it('does not export foreign calculations', async () => {
    const { a, calcB } = await setup();
    const result = await callAs(roleUser(a, 'USER'), exportJsonHandler, { method: 'POST', query: { workspaceId: a.workspace.id }, body: { ids: [calcB.id] } });
    expect(result.status).toBe(404);
  });

  it('serializes concurrent updates of the same calculation (no 409/500, consistent rows)', async () => {
    const { a, contentA } = await setup();
    const user = roleUser(a, 'USER');
    const calcA = await seedCalculation(a.workspace.id, user.user.id, {
      cocktailId: contentA.cocktail.id,
      ingredientId: contentA.ingredient.id,
      unitId: contentA.unit.id,
    });

    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        callAs(user, itemHandler, {
          method: 'PUT',
          query: { workspaceId: a.workspace.id, calculationId: calcA.id },
          body: { ...calcBody(contentA, `Version ${i}`), calculationItems: [{ cocktailId: contentA.cocktail.id, plannedAmount: i + 1 }] },
        }),
      ),
    );
    expect(results.map((r) => r.status)).toEqual(Array(8).fill(200));

    const state = await calculationState(calcA.id);
    expect(state?.cocktailCalculationItems).toHaveLength(1);
    expect(state?.ingredientShoppingUnits).toHaveLength(1);
    expect(`Version ${state!.cocktailCalculationItems[0].plannedAmount - 1}`).toBe(state!.name);
  });

  describe('JSON import', () => {
    function refsOf(content: { cocktail: { name: string }; ingredient: { name: string }; unit: { name: string } }) {
      return { cocktailName: content.cocktail.name, ingredientName: content.ingredient.name, unitName: content.unit.name };
    }

    function mappingsFor(content: { cocktail: { id: string; name: string }; ingredient: { id: string; name: string }; unit: { id: string; name: string } }) {
      return {
        cocktailMappings: [{ exportName: content.cocktail.name, decision: 'use-existing', existingId: content.cocktail.id }],
        ingredientMappings: [{ exportName: content.ingredient.name, decision: 'use-existing', existingId: content.ingredient.id }],
        unitMappings: [{ exportName: content.unit.name, decision: 'use-existing', existingId: content.unit.id }],
      };
    }

    it('requires a write scope for API keys', async () => {
      const { a } = await setup();
      const owner = roleUser(a, 'OWNER').user;
      const readKey = await seedApiKey(a.workspace.id, owner.id, ['CALCULATIONS_READ']);
      const writeKey = await seedApiKey(a.workspace.id, owner.id, ['CALCULATIONS_CREATE']);
      const body = { phase: 'validate', exportData: [] };

      const denied = await callAs({ apiKeyJwt: readKey.jwt }, importJsonHandler, { method: 'POST', query: { workspaceId: a.workspace.id }, body });
      expect(denied.status).toBe(403);
      const allowed = await callAs({ apiKeyJwt: writeKey.jwt }, importJsonHandler, { method: 'POST', query: { workspaceId: a.workspace.id }, body });
      expect(allowed.status).toBe(200);
    });

    it('imports, creates groups/units and overwrites with a full audit diff', async () => {
      const { a, contentA } = await setup();
      const user = roleUser(a, 'USER');
      const existing = await seedCalculation(a.workspace.id, user.user.id, {
        cocktailId: contentA.cocktail.id,
        ingredientId: contentA.ingredient.id,
        unitId: contentA.unit.id,
      });
      const item = calculationExportItem('Imported', { ...refsOf(contentA), unitName: 'Brand new unit' }, { groupName: 'Imported group' });

      const result = await callAs(user, importJsonHandler, {
        method: 'POST',
        query: { workspaceId: a.workspace.id },
        body: {
          phase: 'execute',
          decisions: [
            { exportName: 'Imported', decision: 'import', data: item },
            { exportName: 'Imported', decision: 'overwrite', existingId: existing.id, data: { ...item, cocktailCalculationItems: [] } },
          ],
          cocktailMappings: mappingsFor(contentA).cocktailMappings,
        },
      });
      expect(result.status).toBe(200);
      expect(result.json).toEqual({
        success: true,
        results: [
          { name: 'Imported', status: 'created' },
          { name: 'Imported', status: 'overwritten' },
        ],
      });
      expect(await prisma.unit.count({ where: { workspaceId: a.workspace.id, name: 'Brand new unit' } })).toBe(1);
      expect(await prisma.cocktailCalculationGroup.count({ where: { workspaceId: a.workspace.id, name: 'Imported group' } })).toBe(1);

      const overwritten = await calculationState(existing.id);
      expect(overwritten?.name).toBe('Imported');
      expect(overwritten?.cocktailCalculationItems).toHaveLength(0);
      const log = await prisma.auditLog.findFirst({ where: { entityId: existing.id, action: 'UPDATE' } });
      expect(log?.changes).not.toBeNull();
    });

    it('rejects a foreign overwrite target and foreign mappings without writing anything', async () => {
      const { a, contentA, contentB, calcB } = await setup();
      const before = await calculationState(calcB.id);
      const item = calculationExportItem('Hijack', refsOf(contentA));

      const foreignTarget = await callAs(roleUser(a, 'USER'), importJsonHandler, {
        method: 'POST',
        query: { workspaceId: a.workspace.id },
        body: {
          phase: 'execute',
          decisions: [
            { exportName: 'Valid', decision: 'import', data: calculationExportItem('Valid', refsOf(contentA)) },
            { exportName: 'Hijack', decision: 'overwrite', existingId: calcB.id, data: item },
          ],
          ...mappingsFor(contentA),
        },
      });
      expect(foreignTarget.status).toBe(400);
      expect(errorCodeOf(foreignTarget)).toBe('INVALID_IMPORT_ITEMS');

      const foreignMapping = await callAs(roleUser(a, 'USER'), importJsonHandler, {
        method: 'POST',
        query: { workspaceId: a.workspace.id },
        body: { phase: 'execute', decisions: [{ exportName: 'Hijack', decision: 'import', data: item }], ...mappingsFor(contentB) },
      });
      expect(foreignMapping.status).toBe(400);

      expect(await calculationState(calcB.id)).toEqual(before);
      expect(await prisma.cocktailCalculation.count({ where: { workspaceId: a.workspace.id } })).toBe(0);
    });

    it('is all-or-nothing when one item is invalid', async () => {
      const { a, contentA } = await setup();
      const result = await callAs(roleUser(a, 'USER'), importJsonHandler, {
        method: 'POST',
        query: { workspaceId: a.workspace.id },
        body: {
          phase: 'execute',
          decisions: [
            { exportName: 'Good', decision: 'import', data: calculationExportItem('Good', refsOf(contentA), { groupName: 'New group' }) },
            { exportName: 'Bad', decision: 'import', data: calculationExportItem('Bad', refsOf(contentA), { plannedAmount: 'many' }) },
          ],
          ...mappingsFor(contentA),
        },
      });
      expect(result.status).toBe(400);
      expect((result.json as { error: { issues: Array<{ index: number }> } }).error.issues).toEqual([expect.objectContaining({ index: 1 })]);
      expect(await prisma.cocktailCalculation.count({ where: { workspaceId: a.workspace.id } })).toBe(0);
      expect(await prisma.cocktailCalculationGroup.count({ where: { workspaceId: a.workspace.id } })).toBe(0);
    });

    it('rolls back everything and reports an error when a write fails inside the transaction', async () => {
      const { a, contentA } = await setup();
      await seedUnit(a.workspace.id, 'unused');
      // Make the second insert fail at the database level.
      await prisma.$executeRawUnsafe(`
        CREATE OR REPLACE FUNCTION g3_fail_calculation() RETURNS trigger AS $$
        BEGIN
          IF NEW.name = 'Explodes' THEN RAISE EXCEPTION 'boom'; END IF;
          RETURN NEW;
        END $$ LANGUAGE plpgsql`);
      await prisma.$executeRawUnsafe(
        `CREATE TRIGGER g3_fail_calculation BEFORE INSERT ON "CocktailCalculation" FOR EACH ROW EXECUTE FUNCTION g3_fail_calculation()`,
      );
      try {
        const result = await callAs(roleUser(a, 'USER'), importJsonHandler, {
          method: 'POST',
          query: { workspaceId: a.workspace.id },
          body: {
            phase: 'execute',
            decisions: [
              { exportName: 'Fine', decision: 'import', data: calculationExportItem('Fine', refsOf(contentA), { groupName: 'Rolled back group' }) },
              { exportName: 'Explodes', decision: 'import', data: calculationExportItem('Explodes', refsOf(contentA)) },
            ],
            ...mappingsFor(contentA),
          },
        });
        expect(result.status).toBe(500);
        expect(JSON.stringify(result.json)).not.toContain('boom');
      } finally {
        await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS g3_fail_calculation ON "CocktailCalculation"`);
        await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS g3_fail_calculation()`);
      }
      expect(await prisma.cocktailCalculation.count({ where: { workspaceId: a.workspace.id } })).toBe(0);
      expect(await prisma.cocktailCalculationGroup.count({ where: { workspaceId: a.workspace.id } })).toBe(0);
      expect(await prisma.auditLog.count({ where: { workspaceId: a.workspace.id } })).toBe(0);
    });

    it('reports invalid items in the validate phase instead of failing', async () => {
      const { a, contentA } = await setup();
      const result = await callAs(roleUser(a, 'USER'), importJsonHandler, {
        method: 'POST',
        query: { workspaceId: a.workspace.id },
        body: { phase: 'validate', exportData: [calculationExportItem('Ok', refsOf(contentA)), { calculation: {} }] },
      });
      expect(result.status).toBe(200);
      expect(result.json).toMatchObject({
        valid: false,
        entities: [
          { name: 'Ok', valid: true },
          { name: 'Unbekannt', valid: false },
        ],
      });
    });
  });
});
