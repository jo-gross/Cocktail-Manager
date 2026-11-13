import { describe, it, expect } from 'vitest';
import prisma from '../../../../prisma/prisma';
import { categoriesCollectionHandler, categoriesDefaultsHandler, categoriesItemHandler, definitionsHandler } from '@lib/api/v1/tags';
import { callAs, dataOf, errorCodeOf, roleUser, seedTenantPair } from '@test/helpers/scenario';
import { seedApiKey } from '@test/helpers/dbFixtures';
import { seedTagCategory } from '@test/helpers/fixtures/g4';
import { DEFAULT_TAG_CATEGORIES } from '@lib/tags/defaultTagCategories';
import type { TagCategoryDto, TagDefinitionDto } from '@lib/schemas/tags';

describe('tags v1 integration', () => {
  describe('categories', () => {
    it('appends concurrently created categories with distinct orders', async () => {
      const { a } = await seedTenantPair();
      const ws = a.workspace.id;
      const manager = roleUser(a, 'MANAGER');
      const results = await Promise.all(
        Array.from({ length: 10 }, (_, index) =>
          callAs(manager, categoriesCollectionHandler, { method: 'POST', query: { workspaceId: ws }, body: { name: { de: `Kategorie ${index}` } } }),
        ),
      );
      expect(results.every((result) => result.status === 200)).toBe(true);
      const orders = (await prisma.tagCategory.findMany({ where: { workspaceId: ws } })).map((category) => category.order).sort((x, y) => x - y);
      expect(orders).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });

    it('creates default categories exactly once under concurrency', async () => {
      const { a } = await seedTenantPair();
      const ws = a.workspace.id;
      const manager = roleUser(a, 'MANAGER');
      const results = await Promise.all(
        Array.from({ length: 8 }, () => callAs(manager, categoriesDefaultsHandler, { method: 'POST', query: { workspaceId: ws } })),
      );
      expect(results.every((result) => result.status === 200)).toBe(true);
      expect(await prisma.tagCategory.count({ where: { workspaceId: ws } })).toBe(DEFAULT_TAG_CATEGORIES.length);

      const again = await callAs(manager, categoriesDefaultsHandler, { method: 'POST', query: { workspaceId: ws } });
      expect(dataOf<TagCategoryDto[]>(again)).toHaveLength(DEFAULT_TAG_CATEGORIES.length);
    });

    it('updates and deletes own categories', async () => {
      const { a } = await seedTenantPair();
      const ws = a.workspace.id;
      const manager = roleUser(a, 'MANAGER');
      const category = await seedTagCategory(ws, { name: 'Alt' });

      const put = await callAs(manager, categoriesItemHandler, {
        method: 'PUT',
        query: { workspaceId: ws, categoryId: category.id },
        body: { name: { de: ' Neu ', en: '' }, order: 3 },
      });
      expect(put.status).toBe(200);
      expect(dataOf<TagCategoryDto>(put)).toMatchObject({ name: { de: 'Neu' }, order: 3 });

      const del = await callAs(manager, categoriesItemHandler, { method: 'DELETE', query: { workspaceId: ws, categoryId: category.id } });
      expect(del.status).toBe(200);
      expect(dataOf(del)).toEqual({ count: 1 });
      const again = await callAs(manager, categoriesItemHandler, { method: 'DELETE', query: { workspaceId: ws, categoryId: category.id } });
      expect(again.status).toBe(404);
    });

    it('bulk upsert is all-or-nothing: a tenant B id rejects the request and writes nothing', async () => {
      const { a, b } = await seedTenantPair();
      const ws = a.workspace.id;
      const own = await seedTagCategory(ws, { name: 'Own', order: 0 });
      const foreign = await seedTagCategory(b.workspace.id, { name: 'Foreign', order: 0 });

      const result = await callAs(roleUser(a, 'MANAGER'), categoriesCollectionHandler, {
        method: 'PUT',
        query: { workspaceId: ws },
        body: [
          { id: own.id, name: { de: 'Own renamed' }, order: 1, showAsGuestFilter: false },
          { name: { de: 'New' }, order: 2, showAsGuestFilter: true },
          { id: foreign.id, name: { de: 'Hijacked' }, order: 5, showAsGuestFilter: false },
        ],
      });
      expect(result.status).toBe(400);
      expect(errorCodeOf(result)).toBe('INVALID_REFERENCE');

      expect(await prisma.tagCategory.findMany({ where: { workspaceId: ws } })).toMatchObject([{ id: own.id, name: { de: 'Own' }, order: 0 }]);
      expect(await prisma.tagCategory.findUnique({ where: { id: foreign.id } })).toMatchObject({ name: { de: 'Foreign' }, order: 0 });
    });

    it('returns 404 for tenant B category ids in the path and leaves B unchanged', async () => {
      const { a, b } = await seedTenantPair();
      const owner = roleUser(a, 'OWNER');
      const foreign = await seedTagCategory(b.workspace.id, { name: 'Foreign' });
      const query = { workspaceId: a.workspace.id, categoryId: foreign.id };

      expect((await callAs(owner, categoriesItemHandler, { method: 'PUT', query, body: { name: { de: 'Hijacked' } } })).status).toBe(404);
      expect((await callAs(owner, categoriesItemHandler, { method: 'DELETE', query })).status).toBe(404);
      expect(await prisma.tagCategory.findUnique({ where: { id: foreign.id } })).toMatchObject({ name: { de: 'Foreign' } });
    });

    it('rejects writes for USER and for a TAGS_READ key', async () => {
      const { a } = await seedTenantPair();
      const ws = a.workspace.id;
      const body = { name: { de: 'X' } };
      expect((await callAs(roleUser(a, 'USER'), categoriesCollectionHandler, { method: 'POST', query: { workspaceId: ws }, body })).status).toBe(403);
      const key = await seedApiKey(ws, roleUser(a, 'OWNER').user.id, ['TAGS_READ']);
      expect((await callAs({ apiKeyJwt: key.jwt }, categoriesCollectionHandler, { method: 'POST', query: { workspaceId: ws }, body })).status).toBe(403);
      expect((await callAs({ apiKeyJwt: key.jwt }, categoriesDefaultsHandler, { method: 'POST', query: { workspaceId: ws } })).status).toBe(403);
      expect(await prisma.tagCategory.count()).toBe(0);
    });
  });

  describe('definitions', () => {
    it('upserts definitions with an own category', async () => {
      const { a } = await seedTenantPair();
      const ws = a.workspace.id;
      const category = await seedTagCategory(ws);
      const result = await callAs(roleUser(a, 'MANAGER'), definitionsHandler, {
        method: 'PUT',
        query: { workspaceId: ws },
        body: [{ tag: 'fruity', label: { de: 'Fruchtig' }, categoryId: category.id, color: '#ff8800' }],
      });
      expect(result.status).toBe(200);
      expect(dataOf<TagDefinitionDto[]>(result)).toMatchObject([{ tag: 'fruity', categoryId: category.id, color: '#ff8800', defined: true }]);
    });

    it('rejects a tenant B category id with 400 and writes no definition', async () => {
      const { a, b } = await seedTenantPair();
      const ws = a.workspace.id;
      const own = await seedTagCategory(ws);
      const foreign = await seedTagCategory(b.workspace.id);
      const result = await callAs(roleUser(a, 'MANAGER'), definitionsHandler, {
        method: 'PUT',
        query: { workspaceId: ws },
        body: [
          { tag: 'fruity', categoryId: own.id },
          { tag: 'sour', categoryId: foreign.id },
        ],
      });
      expect(result.status).toBe(400);
      expect(errorCodeOf(result)).toBe('INVALID_REFERENCE');
      expect(await prisma.tagDefinition.count()).toBe(0);
      expect(await prisma.tagCategory.findUnique({ where: { id: foreign.id }, include: { _count: { select: { tags: true } } } })).toMatchObject({
        _count: { tags: 0 },
      });
    });

    it('lists only own definitions', async () => {
      const { a, b } = await seedTenantPair();
      await prisma.tagDefinition.create({ data: { workspaceId: b.workspace.id, tag: 'b-secret' } });
      const result = await callAs(roleUser(a, 'USER'), definitionsHandler, { method: 'GET', query: { workspaceId: a.workspace.id } });
      expect(dataOf(result)).toEqual([]);
    });
  });
});
