import { describe, it, expect } from 'vitest';
import { checkHandler, cloneHandler, collectionHandler, exportJsonHandler, imageHandler, importJsonHandler, itemHandler } from '@lib/api/v1/garnishes';
import { seedApiKey } from '@test/helpers/dbFixtures';
import { callAs, dataOf, errorCodeOf, roleUser, seedTenantPair } from '@test/helpers/scenario';
import { PNG_DATA_URI, SVG_DATA_URI, decision, garnishExportItem, seedCocktailWithStep, seedGarnish } from '@test/helpers/fixtures/g1';
import { GarnishDtoSchema } from '@lib/schemas/garnishes';
import prisma from '../../../../prisma/prisma';

describe('garnishes v1 integration', () => {
  describe('CRUD', () => {
    it('creates, reads, updates, clones and deletes a garnish with audit logs', async () => {
      const { a } = await seedTenantPair();
      const manager = roleUser(a, 'MANAGER');
      const query = { workspaceId: a.workspace.id };

      const created = await callAs(manager, collectionHandler, {
        method: 'POST',
        query,
        body: { name: 'Lime Wheel', price: 0.2, image: PNG_DATA_URI, allergens: ['CELERY'] },
      });
      expect(created.status).toBe(200);
      expect(GarnishDtoSchema.safeParse(dataOf(created)).success).toBe(true);
      const garnishId = dataOf<{ id: string }>(created).id;

      const list = await callAs(roleUser(a, 'USER'), collectionHandler, { method: 'GET', query: { ...query, search: 'lime' } });
      expect(dataOf<unknown[]>(list)).toHaveLength(1);

      const check = await callAs(roleUser(a, 'USER'), checkHandler, { method: 'GET', query: { ...query, name: 'Lime Wheel' } });
      expect(dataOf<{ id: string }>(check).id).toBe(garnishId);

      const updated = await callAs(manager, itemHandler, { method: 'PUT', query: { ...query, garnishId }, body: { name: 'Lime Twist' } });
      expect(updated.status).toBe(200);
      expect(dataOf<{ name: string; hasImage: boolean }>(updated)).toMatchObject({ name: 'Lime Twist', hasImage: false });

      const image = await callAs(manager, imageHandler, { method: 'GET', query: { ...query, garnishId } });
      expect(image.status).toBe(404);

      const cloned = await callAs(manager, cloneHandler, { method: 'POST', query: { ...query, garnishId }, body: { name: 'Lime Twist Copy' } });
      expect(cloned.status).toBe(200);
      const cloneId = dataOf<{ id: string }>(cloned).id;

      const deleted = await callAs(roleUser(a, 'ADMIN'), itemHandler, { method: 'DELETE', query: { ...query, garnishId } });
      expect(deleted.status).toBe(200);
      expect(dataOf(deleted)).toEqual({ count: 1 });

      const actions = await prisma.auditLog.findMany({
        where: { workspaceId: a.workspace.id, entityType: 'Garnish' },
        select: { action: true, entityId: true },
      });
      expect(actions).toEqual(
        expect.arrayContaining([
          { action: 'CREATE', entityId: garnishId },
          { action: 'UPDATE', entityId: garnishId },
          { action: 'CREATE', entityId: cloneId },
          { action: 'DELETE', entityId: garnishId },
        ]),
      );
    });

    it('rejects non-raster images and oversized fields', async () => {
      const { a } = await seedTenantPair();
      const manager = roleUser(a, 'MANAGER');
      const query = { workspaceId: a.workspace.id };

      expect((await callAs(manager, collectionHandler, { method: 'POST', query, body: { name: 'Svg', image: SVG_DATA_URI } })).status).toBe(400);
      expect((await callAs(manager, collectionHandler, { method: 'POST', query, body: { name: 'x'.repeat(256) } })).status).toBe(400);
      expect(await prisma.garnish.count({ where: { workspaceId: a.workspace.id } })).toBe(0);
    });

    it('serves the stored image with safe headers', async () => {
      const { a } = await seedTenantPair();
      const garnish = await seedGarnish(a.workspace.id, 'Mint', true);

      const image = await callAs(roleUser(a, 'USER'), imageHandler, { method: 'GET', query: { workspaceId: a.workspace.id, garnishId: garnish.id } });

      expect(image.status).toBe(200);
      expect(image.headers['Content-Type']).toBe('image/png');
      expect(image.headers['X-Content-Type-Options']).toBe('nosniff');
    });
  });

  describe('authorization', () => {
    it('enforces roles', async () => {
      const { a } = await seedTenantPair();
      const garnish = await seedGarnish(a.workspace.id);
      const query = { workspaceId: a.workspace.id };

      expect((await callAs(roleUser(a, 'USER'), collectionHandler, { method: 'POST', query, body: { name: 'X' } })).status).toBe(403);
      expect((await callAs(roleUser(a, 'USER'), itemHandler, { method: 'PUT', query: { ...query, garnishId: garnish.id }, body: { name: 'X' } })).status).toBe(
        403,
      );
      expect((await callAs(roleUser(a, 'MANAGER'), itemHandler, { method: 'DELETE', query: { ...query, garnishId: garnish.id } })).status).toBe(403);
      expect((await callAs('anonymous', collectionHandler, { method: 'GET', query })).status).toBe(401);
      expect(await prisma.garnish.findUniqueOrThrow({ where: { id: garnish.id } })).toMatchObject({ name: garnish.name });
    });

    it('denies writes to an API key with only GARNISHES_READ', async () => {
      const { a } = await seedTenantPair();
      const key = await seedApiKey(a.workspace.id, roleUser(a, 'OWNER').user.id, ['GARNISHES_READ']);
      const garnish = await seedGarnish(a.workspace.id);
      const query = { workspaceId: a.workspace.id };
      const caller = { apiKeyJwt: key.jwt };

      expect((await callAs(caller, collectionHandler, { method: 'POST', query, body: { name: 'X' } })).status).toBe(403);
      expect((await callAs(caller, itemHandler, { method: 'DELETE', query: { ...query, garnishId: garnish.id } })).status).toBe(403);
      expect(
        (await callAs(caller, importJsonHandler, { method: 'POST', query, body: { phase: 'execute', decisions: [decision(garnishExportItem('X'))] } })).status,
      ).toBe(403);
      expect((await callAs(caller, exportJsonHandler, { method: 'POST', query, body: { ids: [garnish.id] } })).status).toBe(200);
      expect(await prisma.garnish.count({ where: { workspaceId: a.workspace.id } })).toBe(1);
    });
  });

  describe('tenant isolation', () => {
    it("rejects an update of another workspace's garnish and leaves it untouched", async () => {
      const { a, b } = await seedTenantPair();
      const foreign = await seedGarnish(b.workspace.id, 'B Garnish', true);

      const result = await callAs(roleUser(a, 'MANAGER'), itemHandler, {
        method: 'PUT',
        query: { workspaceId: a.workspace.id, garnishId: foreign.id },
        body: { name: 'Stolen' },
      });

      expect(result.status).toBe(404);
      const after = await prisma.garnish.findUniqueOrThrow({ where: { id: foreign.id }, include: { GarnishImage: true } });
      expect(after).toMatchObject({ name: 'B Garnish', workspaceId: b.workspace.id });
      expect(after.GarnishImage).toHaveLength(1);
    });

    it("returns 404 for another workspace's garnish on get, delete, clone and image", async () => {
      const { a, b } = await seedTenantPair();
      const foreign = await seedGarnish(b.workspace.id, 'B Garnish', true);
      const query = { workspaceId: a.workspace.id, garnishId: foreign.id };
      const owner = roleUser(a, 'OWNER');

      expect((await callAs(owner, itemHandler, { method: 'GET', query })).status).toBe(404);
      expect((await callAs(owner, itemHandler, { method: 'DELETE', query })).status).toBe(404);
      expect((await callAs('master', itemHandler, { method: 'DELETE', query })).status).toBe(404);
      expect((await callAs(owner, cloneHandler, { method: 'POST', query, body: { name: 'Copy' } })).status).toBe(404);
      expect((await callAs(owner, imageHandler, { method: 'GET', query })).status).toBe(404);

      expect(await prisma.garnish.findUnique({ where: { id: foreign.id } })).not.toBeNull();
      expect(await prisma.garnish.count({ where: { workspaceId: a.workspace.id } })).toBe(0);
      expect(await prisma.auditLog.count()).toBe(0);
    });

    it("rejects an import that overwrites another workspace's garnish and writes nothing", async () => {
      const { a, b } = await seedTenantPair();
      const foreign = await seedGarnish(b.workspace.id, 'B Garnish');

      const result = await callAs(roleUser(a, 'MANAGER'), importJsonHandler, {
        method: 'POST',
        query: { workspaceId: a.workspace.id },
        body: {
          phase: 'execute',
          decisions: [decision(garnishExportItem('New')), decision(garnishExportItem('B Garnish'), { decision: 'overwrite', existingId: foreign.id })],
        },
      });

      expect(result.status).toBe(400);
      expect(errorCodeOf(result)).toBe('INVALID_REFERENCE');
      expect(await prisma.garnish.findUniqueOrThrow({ where: { id: foreign.id } })).toMatchObject({ name: 'B Garnish', price: 1, description: null });
      expect(await prisma.garnish.count({ where: { workspaceId: a.workspace.id } })).toBe(0);
    });
  });

  describe('import (all-or-nothing)', () => {
    it('writes nothing when one item is invalid', async () => {
      const { a } = await seedTenantPair();

      const result = await callAs(roleUser(a, 'MANAGER'), importJsonHandler, {
        method: 'POST',
        query: { workspaceId: a.workspace.id },
        body: { phase: 'execute', decisions: [decision(garnishExportItem('Valid')), decision(garnishExportItem('Broken', { price: -1 }))] },
      });

      expect(result.status).toBe(400);
      expect(errorCodeOf(result)).toBe('INVALID_IMPORT_ITEMS');
      expect(await prisma.garnish.count({ where: { workspaceId: a.workspace.id } })).toBe(0);
    });

    it('round-trips export → import with overwrite and sanitized guest info', async () => {
      const { a } = await seedTenantPair();
      const existing = await seedGarnish(a.workspace.id, 'Orange Peel');
      const manager = roleUser(a, 'MANAGER');
      const query = { workspaceId: a.workspace.id };

      const exported = await callAs(manager, exportJsonHandler, { method: 'POST', query, body: { ids: [existing.id] } });
      expect(exported.status).toBe(200);
      expect(exported.json).toHaveProperty('garnish.name', 'Orange Peel');

      const result = await callAs(manager, importJsonHandler, {
        method: 'POST',
        query,
        body: {
          phase: 'execute',
          decisions: [
            decision(garnishExportItem('Orange Peel', { price: 3 }), { decision: 'overwrite', existingId: existing.id }),
            decision(exported.json as { garnish: { name: string } }, { decision: 'rename', newName: 'Orange Peel 2' }),
          ],
        },
      });

      expect(result.status).toBe(200);
      expect(result.json).toEqual({
        success: true,
        results: [
          { name: 'Orange Peel', status: 'overwritten' },
          { name: 'Orange Peel 2', status: 'created' },
        ],
      });
      expect(await prisma.garnish.findUniqueOrThrow({ where: { id: existing.id } })).toMatchObject({ price: 3, description: 'desc', allergens: ['CELERY'] });
    });
  });

  describe('delete', () => {
    it('removes the garnish from cocktails that use it (cascade by design)', async () => {
      const { a } = await seedTenantPair();
      const garnish = await seedGarnish(a.workspace.id);
      const cocktail = await seedCocktailWithStep(a.workspace.id);
      await prisma.cocktailRecipeGarnish.create({ data: { cocktailRecipeId: cocktail.id, garnishId: garnish.id, garnishNumber: 0 } });

      const result = await callAs(roleUser(a, 'ADMIN'), itemHandler, { method: 'DELETE', query: { workspaceId: a.workspace.id, garnishId: garnish.id } });

      expect(result.status).toBe(200);
      expect(await prisma.cocktailRecipeGarnish.count({ where: { cocktailRecipeId: cocktail.id } })).toBe(0);
    });
  });
});
