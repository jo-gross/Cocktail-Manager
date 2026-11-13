import { describe, it, expect } from 'vitest';
import {
  collectionHandler,
  itemHandler,
  checkHandler,
  cloneHandler,
  referencesHandler,
  exportJsonHandler,
  importJsonHandler,
  imageHandler,
} from '@lib/api/v1/glasses';
import { invokeHandler } from '@test/helpers/invokeHandler';
import { asMasterKey, sessionCookie } from '@test/helpers/authFixtures';
import { findUserByRole, seedApiKey, seedGlass, seedWorkspace } from '@test/helpers/dbFixtures';
import { callAs, dataOf, errorCodeOf, roleUser, seedTenantPair } from '@test/helpers/scenario';
import { PNG_DATA_URI, SVG_DATA_URI, decision, glassExportItem, openTransaction, seedCocktailWithStep, seedGlassWithImage } from '@test/helpers/fixtures/g1';
import { GlassDtoSchema } from '@lib/schemas/glasses';
import prisma from '../../../../prisma/prisma';

describe('glasses v1 integration', () => {
  async function setup() {
    return seedWorkspace({
      users: [{ role: 'USER' }, { role: 'MANAGER' }, { role: 'ADMIN' }],
    });
  }

  describe('auth', () => {
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
        body: { name: 'Tumbler', deposit: 0 },
        headers: sessionCookie(user.sessionToken),
      });
      expect(result.status).toBe(403);
    });

    it('DELETE item returns 403 for MANAGER role', async () => {
      const seeded = await setup();
      const glass = await seedGlass(seeded.workspace.id);
      const manager = findUserByRole(seeded, 'MANAGER');
      const result = await invokeHandler(itemHandler, {
        method: 'DELETE',
        query: { workspaceId: seeded.workspace.id, glassId: glass.id },
        headers: sessionCookie(manager.sessionToken),
      });
      expect(result.status).toBe(403);
    });
  });

  describe('CRUD success', () => {
    it('creates, reads, updates and deletes a glass', async () => {
      const seeded = await setup();
      const manager = findUserByRole(seeded, 'MANAGER');
      const admin = findUserByRole(seeded, 'ADMIN');
      const headers = sessionCookie(manager.sessionToken);
      const adminHeaders = sessionCookie(admin.sessionToken);

      const createResult = await invokeHandler(collectionHandler, {
        method: 'POST',
        query: { workspaceId: seeded.workspace.id },
        body: { name: 'Highball', deposit: 1.5, volume: 30 },
        headers,
      });
      expect(createResult.status).toBe(200);
      const created = (createResult.json as { data: unknown }).data;
      expect(GlassDtoSchema.safeParse(created).success).toBe(true);
      const glassId = (created as { id: string }).id;

      const listResult = await invokeHandler(collectionHandler, {
        method: 'GET',
        query: { workspaceId: seeded.workspace.id },
        headers: sessionCookie(findUserByRole(seeded, 'USER').sessionToken),
      });
      expect(listResult.status).toBe(200);
      expect((listResult.json as { data: unknown[] }).data).toHaveLength(1);

      const getResult = await invokeHandler(itemHandler, {
        method: 'GET',
        query: { workspaceId: seeded.workspace.id, glassId },
        headers: sessionCookie(findUserByRole(seeded, 'USER').sessionToken),
      });
      expect(getResult.status).toBe(200);

      const updateResult = await invokeHandler(itemHandler, {
        method: 'PUT',
        query: { workspaceId: seeded.workspace.id, glassId },
        body: { name: 'Highball XL', deposit: 2, volume: 35 },
        headers,
      });
      expect(updateResult.status).toBe(200);
      expect((updateResult.json as { data: { name: string } }).data.name).toBe('Highball XL');

      const deleteResult = await invokeHandler(itemHandler, {
        method: 'DELETE',
        query: { workspaceId: seeded.workspace.id, glassId },
        headers: adminHeaders,
      });
      expect(deleteResult.status).toBe(200);
      expect((deleteResult.json as { data: { count: number } }).data.count).toBe(1);
    });
  });

  describe('validation and errors', () => {
    it('returns 400 for invalid create body', async () => {
      const seeded = await setup();
      const manager = findUserByRole(seeded, 'MANAGER');
      const result = await invokeHandler(collectionHandler, {
        method: 'POST',
        query: { workspaceId: seeded.workspace.id },
        body: { deposit: 0 },
        headers: sessionCookie(manager.sessionToken),
      });
      expect(result.status).toBe(400);
      expect(result.json).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    });

    it('returns 404 for unknown glass id', async () => {
      const seeded = await setup();
      const result = await invokeHandler(itemHandler, {
        method: 'GET',
        query: { workspaceId: seeded.workspace.id, glassId: 'nonexistent' },
        headers: sessionCookie(findUserByRole(seeded, 'USER').sessionToken),
      });
      expect(result.status).toBe(404);
    });
  });

  describe('clone and check', () => {
    it('clones an existing glass', async () => {
      const seeded = await setup();
      const glass = await seedGlass(seeded.workspace.id, { name: 'Original' });
      const manager = findUserByRole(seeded, 'MANAGER');

      const result = await invokeHandler(cloneHandler, {
        method: 'POST',
        query: { workspaceId: seeded.workspace.id, glassId: glass.id },
        body: { name: 'Clone' },
        headers: sessionCookie(manager.sessionToken),
      });
      expect(result.status).toBe(200);
      expect((result.json as { data: { name: string } }).data.name).toBe('Clone');
    });

    it('check returns null for short names', async () => {
      const seeded = await setup();
      const result = await invokeHandler(checkHandler, {
        method: 'GET',
        query: { workspaceId: seeded.workspace.id, name: 'ab' },
        headers: sessionCookie(findUserByRole(seeded, 'USER').sessionToken),
      });
      expect(result.status).toBe(200);
      expect((result.json as { data: unknown }).data).toBeNull();
    });
  });

  describe('references', () => {
    it('returns empty references for unused glass', async () => {
      const seeded = await setup();
      const glass = await seedGlass(seeded.workspace.id);
      const result = await invokeHandler(referencesHandler, {
        method: 'GET',
        query: { workspaceId: seeded.workspace.id, glassId: glass.id },
        headers: sessionCookie(findUserByRole(seeded, 'USER').sessionToken),
      });
      expect(result.status).toBe(200);
      expect((result.json as { data: unknown[] }).data).toEqual([]);
    });
  });

  describe('export/import legacy JSON', () => {
    it('exports and imports without { data } envelope', async () => {
      const seeded = await setup();
      const manager = findUserByRole(seeded, 'MANAGER');
      const glass = await seedGlass(seeded.workspace.id, { name: 'Export Glass' });

      const exportResult = await invokeHandler(exportJsonHandler, {
        method: 'POST',
        query: { workspaceId: seeded.workspace.id },
        body: { ids: [glass.id] },
        headers: sessionCookie(findUserByRole(seeded, 'USER').sessionToken),
      });
      expect(exportResult.status).toBe(200);
      expect(exportResult.json).toHaveProperty('glass');

      const importResult = await invokeHandler(importJsonHandler, {
        method: 'POST',
        query: { workspaceId: seeded.workspace.id },
        body: { phase: 'validate', exportData: exportResult.json },
        headers: sessionCookie(manager.sessionToken),
      });
      expect(importResult.status).toBe(200);
      expect(importResult.json).toMatchObject({ valid: true });
    });
  });

  describe('image endpoint', () => {
    it('returns 404 when glass has no image', async () => {
      const seeded = await setup();
      const glass = await seedGlass(seeded.workspace.id);
      const result = await invokeHandler(imageHandler, {
        method: 'GET',
        query: { workspaceId: seeded.workspace.id, glassId: glass.id },
        headers: asMasterKey(),
      });
      expect(result.status).toBe(404);
    });

    it('serves stored images with safe headers and rejects non-raster uploads', async () => {
      const { a } = await seedTenantPair();
      const manager = roleUser(a, 'MANAGER');
      const query = { workspaceId: a.workspace.id };

      const svg = await callAs(manager, collectionHandler, { method: 'POST', query, body: { name: 'Svg', deposit: 0, image: SVG_DATA_URI } });
      expect(svg.status).toBe(400);
      expect(await prisma.glass.count({ where: { workspaceId: a.workspace.id } })).toBe(0);

      const created = await callAs(manager, collectionHandler, { method: 'POST', query, body: { name: 'Png', deposit: 0, image: PNG_DATA_URI } });
      expect(created.status).toBe(200);
      const glassId = dataOf<{ id: string }>(created).id;

      const image = await callAs(roleUser(a, 'USER'), imageHandler, { method: 'GET', query: { ...query, glassId } });
      expect(image.status).toBe(200);
      expect(image.headers['Content-Type']).toBe('image/png');
      expect(image.headers['X-Content-Type-Options']).toBe('nosniff');
      expect(image.headers['Content-Security-Policy']).toContain('sandbox');
    });
  });

  describe('tenant isolation', () => {
    it("rejects a manager's update of another workspace's glass and leaves it untouched", async () => {
      const { a, b } = await seedTenantPair();
      const foreign = await seedGlassWithImage(b.workspace.id, 'B Glass');

      const result = await callAs(roleUser(a, 'MANAGER'), itemHandler, {
        method: 'PUT',
        query: { workspaceId: a.workspace.id, glassId: foreign.id },
        body: { name: 'Stolen', deposit: 0 },
      });

      expect(result.status).toBe(404);
      const after = await prisma.glass.findUniqueOrThrow({ where: { id: foreign.id }, include: { GlassImage: true } });
      expect(after).toMatchObject({ name: 'B Glass', workspaceId: b.workspace.id, deposit: 2 });
      expect(after.GlassImage).toHaveLength(1);
      expect(await prisma.auditLog.count({ where: { workspaceId: a.workspace.id } })).toBe(0);
    });

    it("returns 404 for another workspace's glass on delete, clone, references and image", async () => {
      const { a, b } = await seedTenantPair();
      const foreign = await seedGlassWithImage(b.workspace.id, 'B Glass');
      const query = { workspaceId: a.workspace.id, glassId: foreign.id };
      const owner = roleUser(a, 'OWNER');

      expect((await callAs(owner, itemHandler, { method: 'DELETE', query })).status).toBe(404);
      expect((await callAs(owner, cloneHandler, { method: 'POST', query, body: { name: 'Copy' } })).status).toBe(404);
      expect((await callAs(owner, referencesHandler, { method: 'GET', query })).status).toBe(404);
      expect((await callAs(owner, imageHandler, { method: 'GET', query })).status).toBe(404);
      expect((await callAs('master', itemHandler, { method: 'DELETE', query })).status).toBe(404);

      expect(await prisma.glass.findUnique({ where: { id: foreign.id } })).not.toBeNull();
      expect(await prisma.glass.count({ where: { workspaceId: a.workspace.id } })).toBe(0);
    });

    it("does not export another workspace's glasses", async () => {
      const { a, b } = await seedTenantPair();
      const foreign = await seedGlassWithImage(b.workspace.id, 'B Secret Glass');

      const result = await callAs(roleUser(a, 'USER'), exportJsonHandler, {
        method: 'POST',
        query: { workspaceId: a.workspace.id },
        body: { ids: [foreign.id] },
      });

      expect(result.status).toBe(404);
      expect(JSON.stringify(result.json)).not.toContain('B Secret Glass');
    });

    it("rejects an import that overwrites another workspace's glass and writes nothing", async () => {
      const { a, b } = await seedTenantPair();
      const foreign = await seedGlassWithImage(b.workspace.id, 'B Glass');

      const result = await callAs(roleUser(a, 'MANAGER'), importJsonHandler, {
        method: 'POST',
        query: { workspaceId: a.workspace.id },
        body: {
          phase: 'execute',
          decisions: [decision(glassExportItem('New One')), decision(glassExportItem('B Glass'), { decision: 'overwrite', existingId: foreign.id })],
        },
      });

      expect(result.status).toBe(400);
      expect(errorCodeOf(result)).toBe('INVALID_REFERENCE');
      expect(await prisma.glass.findUniqueOrThrow({ where: { id: foreign.id } })).toMatchObject({ name: 'B Glass', deposit: 2, volume: 30 });
      expect(await prisma.glass.count({ where: { workspaceId: a.workspace.id } })).toBe(0);
    });
  });

  describe('authorization', () => {
    it('denies writes to an API key with only GLASSES_READ', async () => {
      const { a } = await seedTenantPair();
      const key = await seedApiKey(a.workspace.id, roleUser(a, 'OWNER').user.id, ['GLASSES_READ']);
      const glass = await seedGlass(a.workspace.id);
      const query = { workspaceId: a.workspace.id };
      const caller = { apiKeyJwt: key.jwt };

      expect((await callAs(caller, collectionHandler, { method: 'POST', query, body: { name: 'X', deposit: 0 } })).status).toBe(403);
      expect((await callAs(caller, cloneHandler, { method: 'POST', query: { ...query, glassId: glass.id }, body: { name: 'X' } })).status).toBe(403);
      expect(
        (await callAs(caller, importJsonHandler, { method: 'POST', query, body: { phase: 'execute', decisions: [decision(glassExportItem('X'))] } })).status,
      ).toBe(403);
      expect((await callAs(caller, collectionHandler, { method: 'GET', query })).status).toBe(200);
      expect(await prisma.glass.count({ where: { workspaceId: a.workspace.id } })).toBe(1);
    });
  });

  describe('import (all-or-nothing)', () => {
    it('writes nothing when one item is invalid and reports per-item issues', async () => {
      const { a } = await seedTenantPair();

      const result = await callAs(roleUser(a, 'MANAGER'), importJsonHandler, {
        method: 'POST',
        query: { workspaceId: a.workspace.id },
        body: {
          phase: 'execute',
          decisions: [decision(glassExportItem('Valid')), decision(glassExportItem('Broken', { deposit: 'lots' })), decision(glassExportItem('Valid 2'))],
        },
      });

      expect(result.status).toBe(400);
      expect(errorCodeOf(result)).toBe('INVALID_IMPORT_ITEMS');
      expect((result.json as { message: string }).message).toContain('nothing was imported');
      const issues = (result.json as { error: { issues: Array<{ index: number; name: string }> } }).error.issues;
      expect(issues.map((issue) => issue.index)).toEqual([1]);
      expect(await prisma.glass.count({ where: { workspaceId: a.workspace.id } })).toBe(0);
      expect(await prisma.auditLog.count({ where: { workspaceId: a.workspace.id } })).toBe(0);
    });

    it('rejects a malformed request without leaking internals', async () => {
      const { a } = await seedTenantPair();
      const manager = roleUser(a, 'MANAGER');
      const query = { workspaceId: a.workspace.id };

      const badPhase = await callAs(manager, importJsonHandler, { method: 'POST', query, body: { phase: 'drop-tables', exportData: [] } });
      expect(badPhase.status).toBe(400);
      expect(errorCodeOf(badPhase)).toBe('VALIDATION_ERROR');

      const noDecisions = await callAs(manager, importJsonHandler, { method: 'POST', query, body: { phase: 'execute', decisions: [] } });
      expect(noDecisions.status).toBe(400);
      expect(errorCodeOf(noDecisions)).toBe('NO_DECISIONS');

      const overwriteWithoutTarget = await callAs(manager, importJsonHandler, {
        method: 'POST',
        query,
        body: { phase: 'execute', decisions: [decision(glassExportItem('X'), { decision: 'overwrite' })] },
      });
      expect(overwriteWithoutTarget.status).toBe(400);
      expect(errorCodeOf(overwriteWithoutTarget)).toBe('INVALID_IMPORT_ITEMS');

      const exportIdsNotArray = await callAs(manager, exportJsonHandler, { method: 'POST', query, body: { ids: 'abc' } });
      expect(exportIdsNotArray.status).toBe(400);
      expect(exportIdsNotArray.json).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    });

    it('creates, overwrites (with real old data in the audit log), renames and skips in one go', async () => {
      const { a } = await seedTenantPair();
      const existing = await seedGlassWithImage(a.workspace.id, 'Tumbler');

      const result = await callAs(roleUser(a, 'MANAGER'), importJsonHandler, {
        method: 'POST',
        query: { workspaceId: a.workspace.id },
        body: {
          phase: 'execute',
          decisions: [
            decision(glassExportItem('Coupe')),
            decision(glassExportItem('Tumbler', { deposit: 5 }), { decision: 'overwrite', existingId: existing.id }),
            decision(glassExportItem('Tumbler'), { decision: 'rename', newName: 'Tumbler (2)' }),
            decision(glassExportItem('Ignored'), { decision: 'skip' }),
          ],
        },
      });

      expect(result.status).toBe(200);
      expect(result.json).toEqual({
        success: true,
        results: [
          { name: 'Coupe', status: 'created' },
          { name: 'Tumbler', status: 'overwritten' },
          { name: 'Tumbler (2)', status: 'created' },
          { name: 'Ignored', status: 'skipped' },
        ],
      });
      const names = (await prisma.glass.findMany({ where: { workspaceId: a.workspace.id }, orderBy: { name: 'asc' } })).map((g) => g.name);
      expect(names).toEqual(['Coupe', 'Tumbler', 'Tumbler (2)']);
      expect(await prisma.glass.findUniqueOrThrow({ where: { id: existing.id } })).toMatchObject({ deposit: 5, volume: 25 });

      const updateLog = await prisma.auditLog.findFirstOrThrow({ where: { workspaceId: a.workspace.id, entityId: existing.id, action: 'UPDATE' } });
      expect(JSON.stringify(updateLog.changes)).toContain('"lhs":"30 ml"');
    });

    it('validate and prepare-mapping report items and conflicts', async () => {
      const { a } = await seedTenantPair();
      const existing = await seedGlass(a.workspace.id, { name: 'Coupe' });
      const manager = roleUser(a, 'MANAGER');
      const query = { workspaceId: a.workspace.id };

      const validate = await callAs(manager, importJsonHandler, {
        method: 'POST',
        query,
        body: { phase: 'validate', exportData: [glassExportItem('Coupe'), { glass: {} }] },
      });
      expect(validate.status).toBe(200);
      expect(validate.json).toMatchObject({
        valid: false,
        entities: [
          { name: 'Coupe', valid: true },
          { name: 'Unbekannt', valid: false },
        ],
      });

      const mapping = await callAs(manager, importJsonHandler, {
        method: 'POST',
        query,
        body: { phase: 'prepare-mapping', exportData: glassExportItem('coupe') },
      });
      expect(mapping.status).toBe(200);
      expect(mapping.json).toMatchObject({ entities: [{ name: 'coupe', conflicts: [{ id: existing.id, name: 'Coupe' }] }] });
    });
  });

  describe('transactions and concurrency', () => {
    it('clone writes an audit log entry', async () => {
      const { a } = await seedTenantPair();
      const glass = await seedGlassWithImage(a.workspace.id, 'Original');

      const result = await callAs(roleUser(a, 'MANAGER'), cloneHandler, {
        method: 'POST',
        query: { workspaceId: a.workspace.id, glassId: glass.id },
        body: { name: 'Copy' },
      });

      expect(result.status).toBe(200);
      const clone = dataOf<{ id: string; hasImage: boolean }>(result);
      expect(clone.hasImage).toBe(true);
      expect(await prisma.auditLog.count({ where: { workspaceId: a.workspace.id, entityType: 'Glass', entityId: clone.id, action: 'CREATE' } })).toBe(1);
    });

    it('serializes concurrent updates of the same glass (no image conflicts)', async () => {
      const { a } = await seedTenantPair();
      const glass = await seedGlassWithImage(a.workspace.id, 'Busy');
      const manager = roleUser(a, 'MANAGER');

      const results = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          callAs(manager, itemHandler, {
            method: 'PUT',
            query: { workspaceId: a.workspace.id, glassId: glass.id },
            body: { name: `Busy ${i}`, deposit: i, image: PNG_DATA_URI },
          }),
        ),
      );

      expect(results.map((r) => r.status)).toEqual(Array(10).fill(200));
      expect(await prisma.glassImage.count({ where: { glassId: glass.id } })).toBe(1);
    });

    it('never detaches a cocktail that is saved while the glass is being deleted', async () => {
      const { a } = await seedTenantPair();
      const glass = await seedGlass(a.workspace.id, { name: 'Contested' });
      const action = await prisma.workspaceCocktailRecipeStepAction.create({ data: { name: 'Stir', actionGroup: 'MIXING', workspaceId: a.workspace.id } });

      const [deleteResult, ...creates] = await Promise.all([
        callAs(roleUser(a, 'ADMIN'), itemHandler, { method: 'DELETE', query: { workspaceId: a.workspace.id, glassId: glass.id } }),
        ...Array.from({ length: 10 }, (_, i) =>
          prisma.cocktailRecipe
            .create({ data: { name: `Race ${i}`, workspaceId: a.workspace.id, glassId: glass.id, steps: { create: { stepNumber: 0, actionId: action.id } } } })
            .then(
              () => 'created' as const,
              () => 'failed' as const,
            ),
        ),
      ]);

      const created = creates.filter((c) => c === 'created').length;
      const cocktails = await prisma.cocktailRecipe.findMany({ where: { workspaceId: a.workspace.id } });
      expect(cocktails).toHaveLength(created);
      expect(cocktails.every((c) => c.glassId === glass.id)).toBe(true);
      if (deleteResult.status === 200) expect(created).toBe(0);
      else expect(deleteResult.status).toBe(409);
    });

    it('waits for an uncommitted cocktail and then refuses the delete instead of detaching it', async () => {
      const { a } = await seedTenantPair();
      const glass = await seedGlass(a.workspace.id, { name: 'Contested' });
      const action = await prisma.workspaceCocktailRecipeStepAction.create({ data: { name: 'Stir', actionGroup: 'MIXING', workspaceId: a.workspace.id } });

      const pending = await openTransaction((tx) =>
        tx.cocktailRecipe.create({
          data: { name: 'Late', workspaceId: a.workspace.id, glassId: glass.id, steps: { create: { stepNumber: 0, actionId: action.id } } },
        }),
      );
      const deleting = callAs(roleUser(a, 'ADMIN'), itemHandler, { method: 'DELETE', query: { workspaceId: a.workspace.id, glassId: glass.id } });
      await new Promise((resolve) => setTimeout(resolve, 300));
      pending.commit();
      await pending.done;
      const result = await deleting;

      expect(result.status).toBe(409);
      expect(await prisma.cocktailRecipe.findFirstOrThrow({ where: { name: 'Late' } })).toMatchObject({ glassId: glass.id });
    });

    it('rejects deleting a glass that is still in use', async () => {
      const { a } = await seedTenantPair();
      const glass = await seedGlass(a.workspace.id);
      await seedCocktailWithStep(a.workspace.id, glass.id);

      const result = await callAs(roleUser(a, 'ADMIN'), itemHandler, { method: 'DELETE', query: { workspaceId: a.workspace.id, glassId: glass.id } });

      expect(result.status).toBe(409);
      expect(errorCodeOf(result)).toBe('GLASS_IN_USE');
      expect(await prisma.glass.findUnique({ where: { id: glass.id } })).not.toBeNull();
    });
  });
});
