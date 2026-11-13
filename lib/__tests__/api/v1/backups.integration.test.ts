import { describe, expect, it } from 'vitest';
import exportHandler from '@lib/backup/exportHandler';
import importHandler from '@lib/backup/importHandler';
import prisma from '../../../../prisma/prisma';
import { callAs, errorCodeOf, roleUser, seedTenantPair, type Caller } from '@test/helpers/scenario';
import { seedApiKey, seedWorkspace } from '@test/helpers/dbFixtures';
import { databaseFingerprint, seedTenantGraph } from '@test/helpers/fixtures/tenantGraph';
import type { BackupImportReport } from '@lib/backup/backupSecurity';

const PNG = `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString('base64')}`;

async function exportAs(caller: Caller, workspaceId: string) {
  return callAs(caller, exportHandler, { method: 'GET', query: { workspaceId } });
}

/** The UI posts the backup file as text. */
async function importAs(caller: Caller, workspaceId: string, backup: unknown) {
  return callAs(caller, importHandler, { method: 'POST', query: { workspaceId }, body: typeof backup === 'string' ? backup : JSON.stringify(backup) });
}

async function contentCounts(workspaceId: string) {
  const inWorkspace = { workspaceId };
  const cocktail = { cocktailRecipe: inWorkspace };
  return {
    units: await prisma.unit.count({ where: inWorkspace }),
    unitConversions: await prisma.unitConversion.count({ where: inWorkspace }),
    ice: await prisma.ice.count({ where: inWorkspace }),
    actions: await prisma.workspaceCocktailRecipeStepAction.count({ where: inWorkspace }),
    glasses: await prisma.glass.count({ where: inWorkspace }),
    glassImages: await prisma.glassImage.count({ where: { glass: inWorkspace } }),
    garnishes: await prisma.garnish.count({ where: inWorkspace }),
    garnishImages: await prisma.garnishImage.count({ where: { garnish: inWorkspace } }),
    ingredients: await prisma.ingredient.count({ where: inWorkspace }),
    ingredientImages: await prisma.ingredientImage.count({ where: { ingredient: inWorkspace } }),
    ingredientVolumes: await prisma.ingredientVolume.count({ where: inWorkspace }),
    cocktails: await prisma.cocktailRecipe.count({ where: inWorkspace }),
    cocktailImages: await prisma.cocktailRecipeImage.count({ where: cocktail }),
    steps: await prisma.cocktailRecipeStep.count({ where: cocktail }),
    stepIngredients: await prisma.cocktailRecipeIngredient.count({ where: { cocktailRecipeStep: cocktail } }),
    cocktailGarnishes: await prisma.cocktailRecipeGarnish.count({ where: cocktail }),
    cards: await prisma.cocktailCard.count({ where: inWorkspace }),
    cardGroups: await prisma.cocktailCardGroup.count({ where: { cocktailCard: inWorkspace } }),
    cardGroupItems: await prisma.cocktailCardGroupItem.count({ where: { cocktail: inWorkspace } }),
    calculations: await prisma.cocktailCalculation.count({ where: inWorkspace }),
    calculationGroups: await prisma.cocktailCalculationGroup.count({ where: inWorkspace }),
    calculationItems: await prisma.cocktailCalculationItems.count({ where: { calculation: inWorkspace } }),
    tagCategories: await prisma.tagCategory.count({ where: inWorkspace }),
    tagDefinitions: await prisma.tagDefinition.count({ where: inWorkspace }),
    signageSlides: await prisma.signageSlide.count({ where: inWorkspace }),
    guestMenus: await prisma.guestMenu.count({ where: inWorkspace }),
  };
}

async function setup() {
  const pair = await seedTenantPair();
  const graph = await seedTenantGraph(pair.a, 'BACKUP-A');
  const target = await seedWorkspace({ name: 'Import target', users: [{ role: 'OWNER' }, { role: 'ADMIN' }, { role: 'MANAGER' }] });
  return { ...pair, graph, target, targetAdmin: target.users.find((u) => u.role === 'ADMIN')! };
}

describe('backups v1 integration', () => {
  it('round trip: export of A imported into an empty workspace yields the same entity counts', async () => {
    const { a, target, targetAdmin } = await setup();

    const exported = await exportAs(roleUser(a, 'ADMIN'), a.workspace.id);
    expect(exported.status).toBe(200);
    const serialized = JSON.stringify(exported.json);
    expect(serialized).not.toMatch(/accessCodeHash|previewToken|signageKey/);

    const imported = await importAs(targetAdmin, target.workspace.id, serialized);
    expect(imported.status).toBe(200);
    const report = (imported.json as { report: BackupImportReport }).report;
    // The seeded custom template has an empty (invalid) definition → skipped and reported, not fatal.
    expect(report.skipped.map((item) => item.type)).toEqual(['guestMenuTemplate']);

    expect(await contentCounts(target.workspace.id)).toEqual(await contentCounts(a.workspace.id));

    // Imported guest menus are never live and nothing references tenant A.
    const menus = await prisma.guestMenu.findMany({ where: { workspaceId: target.workspace.id } });
    expect(menus.every((menu) => !menu.enabled && menu.published === null)).toBe(true);
    const cocktail = await prisma.cocktailRecipe.findFirstOrThrow({ where: { workspaceId: target.workspace.id } });
    const glass = await prisma.glass.findFirstOrThrow({ where: { id: cocktail.glassId! } });
    expect(glass.workspaceId).toBe(target.workspace.id);
    const ice = await prisma.ice.findFirstOrThrow({ where: { id: cocktail.iceId! } });
    expect(ice.workspaceId).toBe(target.workspace.id);

    const audit = await prisma.auditLog.findMany({ where: { workspaceId: target.workspace.id, entityType: 'WorkspaceBackup' } });
    expect(audit).toHaveLength(1);
    expect(audit[0]!.userId).toBe(targetAdmin.user.id);
  });

  it('appends imported slides after the existing slides of the workspace', async () => {
    const { target, targetAdmin } = await setup();
    await prisma.signage.create({ data: { workspaceId: target.workspace.id, format: 'PORTRAIT' } });
    await prisma.signageSlide.createMany({
      data: [0, 1, 2].map((order) => ({ workspaceId: target.workspace.id, format: 'PORTRAIT' as const, content: PNG, order })),
    });

    const result = await importAs(targetAdmin, target.workspace.id, {
      signageSlides: [
        { id: 's2', format: 'PORTRAIT', content: PNG, order: 1 },
        { id: 's1', format: 'PORTRAIT', content: PNG, order: 0 },
      ],
    });
    expect(result.status).toBe(200);

    const orders = (await prisma.signageSlide.findMany({ where: { workspaceId: target.workspace.id }, orderBy: { order: 'asc' } })).map((s) => s.order);
    expect(orders).toEqual([0, 1, 2, 3, 4]);
  });

  describe('all-or-nothing', () => {
    it('rejects a structurally invalid backup with 400 and writes nothing', async () => {
      const { target, targetAdmin } = await setup();
      const before = await databaseFingerprint();
      const result = await importAs(targetAdmin, target.workspace.id, {
        glass: [{ id: 'g1', name: 'Ok', deposit: 1 }],
        ingredient: [{ id: 'i1', name: 'x'.repeat(10_000) }],
      });
      expect(result.status).toBe(400);
      expect(errorCodeOf(result)).toBe('VALIDATION_ERROR');
      expect(await databaseFingerprint()).toBe(before);
    });

    it('rejects SVG/HTML images', async () => {
      const { target, targetAdmin } = await setup();
      const before = await databaseFingerprint();
      const svg = `data:image/svg+xml;base64,${Buffer.from('<svg onload="alert(1)"/>').toString('base64')}`;
      const result = await importAs(targetAdmin, target.workspace.id, {
        glass: [{ id: 'g1', name: 'Glass', deposit: 0 }],
        glassImages: [{ glassId: 'g1', image: svg }],
      });
      expect(result.status).toBe(400);
      expect(await databaseFingerprint()).toBe(before);
    });

    it('rejects broken references (formerly a crash half-way through) with 400 and writes nothing', async () => {
      const { target, targetAdmin } = await setup();
      const before = await databaseFingerprint();
      const result = await importAs(targetAdmin, target.workspace.id, {
        glass: [{ id: 'g1', name: 'Glass', deposit: 0 }],
        cocktailRecipe: [{ id: 'c1', name: 'Cocktail', glassId: 'missing-glass' }],
      });
      expect(result.status).toBe(400);
      expect(errorCodeOf(result)).toBe('INVALID_REFERENCE');
      expect(await databaseFingerprint()).toBe(before);
    });

    it('rolls back everything when the import fails inside the transaction', async () => {
      const { target, targetAdmin } = await setup();
      const before = await databaseFingerprint();
      // Legacy step whose tool matches no action: only detectable against the database.
      const result = await importAs(targetAdmin, target.workspace.id, {
        units: [{ id: 'u1', name: 'CL' }],
        glass: [{ id: 'g1', name: 'Glass', deposit: 0 }],
        cocktailRecipe: [{ id: 'c1', name: 'Cocktail', glassId: 'g1' }],
        cocktailRecipeStep: [{ id: 's1', stepNumber: 0, cocktailRecipeId: 'c1', tool: 'NO_SUCH_TOOL' }],
      });
      expect(result.status).toBe(400);
      expect(errorCodeOf(result)).toBe('INVALID_REFERENCE');
      expect(await databaseFingerprint()).toBe(before);
    });

    it('rejects a body that is not JSON', async () => {
      const { target, targetAdmin } = await setup();
      const result = await importAs(targetAdmin, target.workspace.id, '{not json');
      expect(result.status).toBe(400);
      expect(errorCodeOf(result)).toBe('INVALID_JSON');
    });
  });

  describe('methods', () => {
    it('import answers non-POST with 405', async () => {
      const { a } = await setup();
      for (const method of ['GET', 'PUT', 'DELETE']) {
        const result = await callAs(roleUser(a, 'ADMIN'), importHandler, { method, query: { workspaceId: a.workspace.id } });
        expect(result.status).toBe(405);
      }
    });

    it('export answers non-GET with 405', async () => {
      const { a } = await setup();
      const result = await callAs(roleUser(a, 'ADMIN'), exportHandler, { method: 'POST', query: { workspaceId: a.workspace.id } });
      expect(result.status).toBe(405);
    });
  });

  describe('authorization and tenant isolation', () => {
    it('denies MANAGER sessions and API keys without the backup scope', async () => {
      const { a } = await setup();
      expect((await exportAs(roleUser(a, 'MANAGER'), a.workspace.id)).status).toBe(403);
      expect((await importAs(roleUser(a, 'MANAGER'), a.workspace.id, {})).status).toBe(403);
      const readKey = await seedApiKey(a.workspace.id, roleUser(a, 'OWNER').user.id, ['WORKSPACE_READ', 'COCKTAILS_READ']);
      expect((await exportAs({ apiKeyJwt: readKey.jwt }, a.workspace.id)).status).toBe(403);
      const exportKey = await seedApiKey(a.workspace.id, roleUser(a, 'OWNER').user.id, ['BACKUPS_EXPORT']);
      expect((await importAs({ apiKeyJwt: exportKey.jwt }, a.workspace.id, {})).status).toBe(403);
    });

    it('A cannot export or import workspace B (session and API key)', async () => {
      const { a, b } = await setup();
      await seedTenantGraph(b, 'BACKUP-B');
      const before = await databaseFingerprint();

      const exported = await exportAs(roleUser(a, 'OWNER'), b.workspace.id);
      expect(exported.status).toBe(403);
      expect(JSON.stringify(exported.json)).not.toContain('BACKUP-B');

      expect((await importAs(roleUser(a, 'OWNER'), b.workspace.id, { glass: [{ id: 'g', name: 'Intruder', deposit: 0 }] })).status).toBe(403);

      expect(await databaseFingerprint()).toBe(before);

      const countsB = await contentCounts(b.workspace.id);
      const keyA = await seedApiKey(a.workspace.id, roleUser(a, 'OWNER').user.id, ['BACKUPS_EXPORT', 'BACKUPS_IMPORT']);
      expect((await exportAs({ apiKeyJwt: keyA.jwt }, b.workspace.id)).status).toBe(403);
      expect((await importAs({ apiKeyJwt: keyA.jwt }, b.workspace.id, { glass: [{ id: 'g', name: 'Intruder', deposit: 0 }] })).status).toBe(403);
      expect(await prisma.glass.count({ where: { workspaceId: b.workspace.id, name: 'Intruder' } })).toBe(0);
      expect(await contentCounts(b.workspace.id)).toEqual(countsB);
    });

    it('master key import attributes calculations to a workspace owner', async () => {
      const { a, target } = await setup();
      const backup = (await exportAs(roleUser(a, 'ADMIN'), a.workspace.id)).json;
      const result = await importAs('master', target.workspace.id, JSON.stringify(backup));
      expect(result.status).toBe(200);
      const owner = target.users.find((u) => u.role === 'OWNER')!;
      const calculations = await prisma.cocktailCalculation.findMany({ where: { workspaceId: target.workspace.id } });
      expect(calculations.length).toBeGreaterThan(0);
      expect(calculations.every((calculation) => calculation.updatedByUserId === owner.user.id)).toBe(true);
    });

    it('concurrent imports into the same workspace keep slide orders unique', async () => {
      const { target, targetAdmin } = await setup();
      const backup = { signageSlides: [0, 1].map((order) => ({ format: 'LANDSCAPE', content: PNG, order })) };
      const results = await Promise.all(Array.from({ length: 5 }, () => importAs(targetAdmin, target.workspace.id, backup)));
      expect(results.map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);
      const orders = (await prisma.signageSlide.findMany({ where: { workspaceId: target.workspace.id }, orderBy: { order: 'asc' } })).map((s) => s.order);
      expect(orders).toEqual(Array.from({ length: 10 }, (_, i) => i));
    });
  });
});
