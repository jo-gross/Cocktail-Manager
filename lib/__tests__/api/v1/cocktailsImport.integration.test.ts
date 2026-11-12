import { describe, it, expect } from 'vitest';
import { exportJsonHandler, importJsonHandler } from '@lib/api/v1/cocktails';
import { seedApiKey } from '@test/helpers/dbFixtures';
import { callAs, roleUser, seedTenantPair, type Caller } from '@test/helpers/scenario';
import { cocktailSnapshot, loadCocktail, seedFullCocktail, seedRecipeDeps, SVG_DATA_URI, workspaceContentCounts } from '@test/helpers/fixtures/g2';
import prisma from '../../../../prisma/prisma';

type Dump = Record<string, unknown> & {
  cocktailRecipes: Array<{ id: string; name: string }>;
  glasses: Array<{ id: string; name: string }>;
  stepActions: Array<{ id: string; name: string }>;
  cocktailRecipeImages: Array<{ cocktailRecipeId: string; image: string }>;
};

interface EntityDecision {
  exportId: string;
  decision: 'use-existing' | 'create-new';
  existingId?: string;
  newEntityData?: Record<string, unknown>;
}

type Decisions = Record<'glasses' | 'garnishes' | 'ingredients' | 'units' | 'ice' | 'stepActions', EntityDecision[]> & {
  cocktails: Array<{ exportId: string; decision: string; newName?: string; overwriteId?: string }>;
};

async function exportDump(caller: Caller, workspaceId: string, cocktailIds: string[]): Promise<Dump> {
  const result = await callAs(caller, exportJsonHandler, { method: 'POST', query: { workspaceId }, body: { cocktailIds } });
  expect(result.status).toBe(200);
  return result.json as Dump;
}

/** Runs prepare-mapping and turns its auto-mappings into execute decisions (all cocktails imported). */
async function autoDecisions(caller: Caller, workspaceId: string, exportData: Dump): Promise<Decisions> {
  const result = await callAs(caller, importJsonHandler, { method: 'POST', query: { workspaceId }, body: { phase: 'prepare-mapping', exportData } });
  expect(result.status).toBe(200);
  const { autoMappings } = result.json as { autoMappings: Omit<Decisions, 'cocktails'> };
  return { ...autoMappings, cocktails: exportData.cocktailRecipes.map((c) => ({ exportId: c.id, decision: 'import' })) };
}

function execute(caller: Caller, workspaceId: string, exportData: unknown, mappingDecisions: unknown) {
  return callAs(caller, importJsonHandler, { method: 'POST', query: { workspaceId }, body: { phase: 'execute', exportData, mappingDecisions } });
}

describe('cocktail JSON import v1 integration', () => {
  it('round-trips an export from tenant B into tenant A (all dependencies created, audit entries written)', async () => {
    const { a, b } = await seedTenantPair();
    const cocktailB = await seedFullCocktail(b.workspace.id, await seedRecipeDeps(b.workspace.id));
    const dump = await exportDump(roleUser(b, 'USER'), b.workspace.id, [cocktailB.id]);
    const manager = roleUser(a, 'MANAGER');

    const validate = await callAs(manager, importJsonHandler, {
      method: 'POST',
      query: { workspaceId: a.workspace.id },
      body: { phase: 'validate', exportData: dump },
    });
    expect(validate.json).toMatchObject({ valid: true, cocktailCount: 1 });

    const decisions = await autoDecisions(manager, a.workspace.id, dump);
    expect(decisions.glasses[0].decision).toBe('create-new');
    const result = await execute(manager, a.workspace.id, dump, decisions);

    expect(result.status).toBe(200);
    expect(result.json).toMatchObject({
      success: true,
      imported: { cocktails: 1 },
      created: { glasses: 1, garnishes: 1, ingredients: 1, units: 1, ice: 1, stepActions: 1 },
    });
    const imported = await prisma.cocktailRecipe.findFirstOrThrow({ where: { workspaceId: a.workspace.id }, select: { id: true } });
    const full = await loadCocktail(imported.id);
    expect(full.steps.map((s) => s.ingredients.length)).toEqual([1, 1]);
    expect(full.garnishes[0].isAlternative).toBe(true);
    expect(full.CocktailRecipeImage).toHaveLength(1);
    expect(await prisma.ingredientVolume.count({ where: { workspaceId: a.workspace.id } })).toBe(1);
    // B is untouched, everything new lives in A.
    expect(await prisma.cocktailRecipe.count({ where: { workspaceId: b.workspace.id } })).toBe(1);
    const auditTypes = (await prisma.auditLog.findMany({ where: { workspaceId: a.workspace.id }, select: { entityType: true } })).map((l) => l.entityType);
    expect(auditTypes.sort()).toEqual(['CocktailRecipe', 'Garnish', 'Glass', 'Ingredient']);
  });

  it('requires MANAGER (403 for USER) and COCKTAILS_UPDATE on API keys for overwrites', async () => {
    const { a } = await seedTenantPair();
    const cocktail = await seedFullCocktail(a.workspace.id, await seedRecipeDeps(a.workspace.id));
    const dump = await exportDump('master', a.workspace.id, [cocktail.id]);
    const decisions = await autoDecisions('master', a.workspace.id, dump);

    const asUser = await execute(roleUser(a, 'USER'), a.workspace.id, dump, decisions);
    expect(asUser.status).toBe(403);

    const createOnly = await seedApiKey(a.workspace.id, roleUser(a, 'OWNER').user.id, ['COCKTAILS_CREATE']);
    const overwrite = { ...decisions, cocktails: [{ exportId: cocktail.id, decision: 'overwrite', overwriteId: cocktail.id }] };
    const before = await workspaceContentCounts(a.workspace.id);
    const denied = await execute({ apiKeyJwt: createOnly.jwt }, a.workspace.id, dump, overwrite);
    expect(denied.status).toBe(403);
    expect(await workspaceContentCounts(a.workspace.id)).toEqual(before);

    const allowed = await execute({ apiKeyJwt: createOnly.jwt }, a.workspace.id, dump, {
      ...decisions,
      cocktails: [{ exportId: cocktail.id, decision: 'rename', newName: 'Copy' }],
    });
    expect(allowed.status).toBe(200);
  });

  it("rejects overwriting another tenant's cocktail (400) and leaves it intact", async () => {
    const { a, b } = await seedTenantPair();
    const cocktailA = await seedFullCocktail(a.workspace.id, await seedRecipeDeps(a.workspace.id));
    const cocktailB = await seedFullCocktail(b.workspace.id, await seedRecipeDeps(b.workspace.id));
    await prisma.cocktailRating.create({ data: { cocktailId: cocktailB.id, rating: 5 } });
    const beforeB = await cocktailSnapshot(cocktailB.id);
    const dump = await exportDump('master', a.workspace.id, [cocktailA.id]);
    const decisions = await autoDecisions('master', a.workspace.id, dump);
    const beforeA = await workspaceContentCounts(a.workspace.id);

    for (const caller of [roleUser(a, 'OWNER'), 'master' as const]) {
      const result = await execute(caller, a.workspace.id, dump, {
        ...decisions,
        cocktails: [{ exportId: cocktailA.id, decision: 'overwrite', overwriteId: cocktailB.id }],
      });
      expect(result.status).toBe(400);
      expect(result.json).toMatchObject({ error: { code: 'INVALID_IMPORT' } });
    }

    expect(await cocktailSnapshot(cocktailB.id)).toEqual(beforeB);
    expect(await prisma.cocktailRecipe.findUniqueOrThrow({ where: { id: cocktailB.id } })).toMatchObject({ workspaceId: b.workspace.id });
    expect(await workspaceContentCounts(a.workspace.id)).toEqual(beforeA);
  });

  it.each(['glasses', 'garnishes', 'ingredients', 'units', 'ice', 'stepActions'] as const)(
    "rejects 'use-existing' %s of another tenant (400, nothing written)",
    async (kind) => {
      const { a, b } = await seedTenantPair();
      const cocktail = await seedFullCocktail(a.workspace.id, await seedRecipeDeps(a.workspace.id));
      const depsB = await seedRecipeDeps(b.workspace.id);
      const foreignId = {
        glasses: depsB.glass,
        garnishes: depsB.garnish,
        ingredients: depsB.ingredient,
        units: depsB.unit,
        ice: depsB.ice,
        stepActions: depsB.action,
      }[kind].id;
      const dump = await exportDump('master', a.workspace.id, [cocktail.id]);
      const decisions = await autoDecisions('master', a.workspace.id, dump);
      decisions[kind] = decisions[kind].map((d) => ({ exportId: d.exportId, decision: 'use-existing', existingId: foreignId }));
      const before = await workspaceContentCounts(a.workspace.id);

      const result = await execute(roleUser(a, 'OWNER'), a.workspace.id, dump, decisions);

      expect(result.status).toBe(400);
      expect((result.json as { errors: unknown[] }).errors.length).toBeGreaterThan(0);
      expect(await workspaceContentCounts(a.workspace.id)).toEqual(before);
      expect(await prisma.cocktailRecipeStep.count({ where: { actionId: depsB.action.id } })).toBe(0);
    },
  );

  it('is all-or-nothing: one cocktail with an unmapped reference rejects the whole import', async () => {
    const { a, b } = await seedTenantPair();
    const depsB = await seedRecipeDeps(b.workspace.id);
    const first = await seedFullCocktail(b.workspace.id, depsB, 'First');
    const second = await seedFullCocktail(b.workspace.id, depsB, 'Second');
    const otherAction = await prisma.workspaceCocktailRecipeStepAction.create({ data: { name: 'Stir', actionGroup: 'MIXING', workspaceId: b.workspace.id } });
    await prisma.cocktailRecipeStep.create({ data: { cocktailRecipeId: second.id, stepNumber: 2, actionId: otherAction.id } });
    const dump = await exportDump('master', b.workspace.id, [first.id, second.id]);
    const decisions = await autoDecisions('master', a.workspace.id, dump);
    decisions.stepActions = decisions.stepActions.filter((d) => d.exportId !== otherAction.id);
    const before = await workspaceContentCounts(a.workspace.id);

    const result = await execute(roleUser(a, 'MANAGER'), a.workspace.id, dump, decisions);

    expect(result.status).toBe(400);
    const errors = (result.json as { errors: Array<{ entityName: string; error: string }> }).errors;
    expect(errors).toEqual([expect.objectContaining({ entityName: 'Second', error: expect.stringContaining('Stir') })]);
    expect(await workspaceContentCounts(a.workspace.id)).toEqual(before);
  });

  it('rejects dumps with invalid items (non-raster image) in every phase without writing', async () => {
    const { a, b } = await seedTenantPair();
    const cocktail = await seedFullCocktail(b.workspace.id, await seedRecipeDeps(b.workspace.id));
    const dump = await exportDump('master', b.workspace.id, [cocktail.id]);
    const decisions = await autoDecisions('master', a.workspace.id, dump);
    dump.cocktailRecipeImages[0].image = SVG_DATA_URI;
    const manager = roleUser(a, 'MANAGER');

    const validate = await callAs(manager, importJsonHandler, {
      method: 'POST',
      query: { workspaceId: a.workspace.id },
      body: { phase: 'validate', exportData: dump },
    });
    expect(validate.status).toBe(400);
    expect(validate.json).toMatchObject({ valid: false });
    expect((await execute(manager, a.workspace.id, dump, decisions)).status).toBe(400);
    expect((await execute(manager, a.workspace.id, { exportVersion: '1' }, decisions)).status).toBe(400);
    expect((await callAs(manager, importJsonHandler, { method: 'POST', query: { workspaceId: a.workspace.id }, body: { phase: 'drop-tables' } })).status).toBe(
      400,
    );
    expect(await prisma.cocktailRecipe.count({ where: { workspaceId: a.workspace.id } })).toBe(0);
  });

  it('overwrites an own cocktail in place (ratings kept, UPDATE audit entry)', async () => {
    const { a } = await seedTenantPair();
    const deps = await seedRecipeDeps(a.workspace.id);
    const source = await seedFullCocktail(a.workspace.id, deps, 'Source');
    const target = await seedFullCocktail(a.workspace.id, deps, 'Target');
    await prisma.cocktailRecipeStep.deleteMany({ where: { cocktailRecipeId: source.id, stepNumber: 1 } });
    await prisma.cocktailRating.create({ data: { cocktailId: target.id, rating: 4 } });
    const dump = await exportDump('master', a.workspace.id, [source.id]);
    const decisions = await autoDecisions('master', a.workspace.id, dump);

    const result = await execute(roleUser(a, 'MANAGER'), a.workspace.id, dump, {
      ...decisions,
      cocktails: [{ exportId: source.id, decision: 'overwrite', overwriteId: target.id }],
    });

    expect(result.status).toBe(200);
    const after = await loadCocktail(target.id);
    expect(after.name).toBe('Source');
    expect(after.steps).toHaveLength(1);
    expect(after.ratings).toHaveLength(1);
    expect(await prisma.auditLog.count({ where: { entityId: target.id, action: 'UPDATE' } })).toBe(1);
    expect(await prisma.cocktailRecipe.count({ where: { workspaceId: a.workspace.id } })).toBe(2);
  });

  it('merges new labels into the workspace translations without dropping existing keys', async () => {
    const { a, b } = await seedTenantPair();
    const cocktail = await seedFullCocktail(b.workspace.id, await seedRecipeDeps(b.workspace.id));
    await prisma.workspaceSetting.create({ data: { workspaceId: a.workspace.id, setting: 'translations', value: JSON.stringify({ de: { KEEP: 'bleibt' } }) } });
    const dump = await exportDump('master', b.workspace.id, [cocktail.id]);
    const decisions = await autoDecisions('master', a.workspace.id, dump);
    decisions.stepActions = decisions.stepActions.map((d) => ({ ...d, newEntityData: { name: 'NEW_ACTION', labelDe: 'Neu', labelEn: 'New' } }));

    const result = await execute(roleUser(a, 'MANAGER'), a.workspace.id, dump, decisions);

    expect(result.status).toBe(200);
    const setting = await prisma.workspaceSetting.findFirstOrThrow({ where: { workspaceId: a.workspace.id, setting: 'translations' } });
    expect(JSON.parse(setting.value)).toEqual({ de: { KEEP: 'bleibt', NEW_ACTION: 'Neu' }, en: { NEW_ACTION: 'New' } });
  });

  it('serializes concurrent imports: dependencies are created once and reused', async () => {
    const { a, b } = await seedTenantPair();
    const cocktail = await seedFullCocktail(b.workspace.id, await seedRecipeDeps(b.workspace.id, 'shared'));
    const dump = await exportDump('master', b.workspace.id, [cocktail.id]);
    const decisions = await autoDecisions('master', a.workspace.id, dump);
    const manager = roleUser(a, 'MANAGER');

    const results = await Promise.all(Array.from({ length: 8 }, () => execute(manager, a.workspace.id, dump, decisions)));

    expect(results.map((r) => r.status)).toEqual(Array(8).fill(200));
    expect(await prisma.cocktailRecipe.count({ where: { workspaceId: a.workspace.id } })).toBe(8);
    expect(await prisma.glass.count({ where: { workspaceId: a.workspace.id, name: 'Glass shared' } })).toBe(1);
    expect(await prisma.ingredient.count({ where: { workspaceId: a.workspace.id, name: 'Rum shared' } })).toBe(1);
    expect(await prisma.garnish.count({ where: { workspaceId: a.workspace.id } })).toBe(1);
  });
});
