/**
 * Guest menus (v1): CRUD + publish lifecycle, tenant isolation (path and body ids),
 * role/API-key scope, audit logs in the same transaction, slug/priority/default
 * concurrency and the optimistic publish check.
 */
import { describe, expect, it, vi } from 'vitest';
import prisma from '../../../../prisma/prisma';
import {
  collectionHandler,
  duplicateHandler,
  itemHandler,
  previewTokenRegenerateHandler,
  publishHandler,
  reorderHandler,
  templatesItemHandler,
  unpublishHandler,
  draftHandler,
} from '@lib/api/v1/guestMenus';
import { seedApiKey } from '@test/helpers/dbFixtures';
import { callAs, dataOf, errorCodeOf, roleUser, seedTenantPair } from '@test/helpers/scenario';
import { seedCard, seedGuestMenu, seedGuestMenuTemplate, snapshotGuestMenu } from '@test/helpers/fixtures/g5';
import { createDefaultGuestMenuDocument } from '@lib/guest-menu/schema';

// Lets a test change the menu while publish validation (outside the transaction) runs.
const publishHook = vi.hoisted(() => ({ duringValidation: null as null | (() => Promise<void>) }));
vi.mock('@lib/guest-menu/server', async (importOriginal) => {
  const original = await importOriginal<typeof import('@lib/guest-menu/server')>();
  return {
    ...original,
    validateForPublish: async (...args: Parameters<typeof original.validateForPublish>) => {
      const issues = await original.validateForPublish(...args);
      if (publishHook.duringValidation) await publishHook.duringValidation();
      return issues;
    },
  };
});

interface MenuDto {
  id: string;
  slug: string;
  priority: number;
  isDefault: boolean;
  isPublished: boolean;
  previewToken: string | null;
}

describe('guest menus v1 (integration)', () => {
  it('creates, updates, publishes, unpublishes, duplicates, regenerates and deletes with audit logs', async () => {
    const { a } = await seedTenantPair();
    const manager = roleUser(a, 'MANAGER');
    const admin = roleUser(a, 'ADMIN');
    const workspaceId = a.workspace.id;

    const created = await callAs(manager, collectionHandler, { method: 'POST', query: { workspaceId }, body: { name: 'Abend Karte!' } });
    expect(created.status).toBe(201);
    const menu = dataOf<MenuDto>(created);
    expect(menu.slug).toBe('abend-karte');
    expect(menu.priority).toBe(0);

    const patched = await callAs(manager, itemHandler, {
      method: 'PATCH',
      query: { workspaceId, menuId: menu.id },
      body: { name: 'Abendkarte', isDefault: true },
    });
    expect(patched.status).toBe(200);
    expect(dataOf<MenuDto>(patched).isDefault).toBe(true);

    const published = await callAs(manager, publishHandler, { method: 'POST', query: { workspaceId, menuId: menu.id } });
    expect(published.status).toBe(200);
    expect(dataOf<MenuDto>(published).isPublished).toBe(true);

    const unpublished = await callAs(manager, unpublishHandler, { method: 'POST', query: { workspaceId, menuId: menu.id } });
    expect(dataOf<MenuDto>(unpublished).isPublished).toBe(false);

    const duplicate = await callAs(manager, duplicateHandler, { method: 'POST', query: { workspaceId, menuId: menu.id }, body: {} });
    expect(duplicate.status).toBe(201);
    expect(dataOf<MenuDto>(duplicate)).toMatchObject({ isDefault: false, priority: 1 });

    const regenerated = await callAs(manager, previewTokenRegenerateHandler, { method: 'POST', query: { workspaceId, menuId: menu.id } });
    expect(dataOf<MenuDto>(regenerated).previewToken).not.toBe(menu.previewToken);

    const deleted = await callAs(admin, itemHandler, { method: 'DELETE', query: { workspaceId, menuId: menu.id } });
    expect(deleted.status).toBe(200);
    expect(dataOf(deleted)).toEqual({ count: 1 });

    const logs = await prisma.auditLog.findMany({ where: { workspaceId, entityType: 'GuestMenu' }, orderBy: { createdAt: 'asc' } });
    const ofMenu = logs.filter((log) => log.entityId === menu.id).map((log) => log.action);
    // create, patch, publish, unpublish, regenerate, delete
    expect(ofMenu).toEqual(['CREATE', 'UPDATE', 'UPDATE', 'UPDATE', 'UPDATE', 'DELETE']);
    expect(logs.filter((log) => log.entityId === dataOf<MenuDto>(duplicate).id).map((log) => log.action)).toEqual(['CREATE']);
    expect(JSON.stringify(logs)).not.toContain(dataOf<MenuDto>(regenerated).previewToken!);
  });

  it('returns 404 for a nonexistent menu on delete', async () => {
    const { a } = await seedTenantPair();
    const result = await callAs(roleUser(a, 'ADMIN'), itemHandler, { method: 'DELETE', query: { workspaceId: a.workspace.id, menuId: 'does-not-exist' } });
    expect(result.status).toBe(404);
  });

  describe('tenant isolation', () => {
    it("rejects tenant B's menu id in the path and leaves it unchanged", async () => {
      const { a, b } = await seedTenantPair();
      const owner = roleUser(a, 'OWNER');
      const foreign = await seedGuestMenu(b.workspace.id, { slug: 'foreign' });
      const before = await snapshotGuestMenu(foreign.id);
      const query = { workspaceId: a.workspace.id, menuId: foreign.id };

      const calls = [
        callAs(owner, itemHandler, { method: 'GET', query }),
        callAs(owner, itemHandler, { method: 'PATCH', query, body: { name: 'hijacked', isDefault: true } }),
        callAs(owner, draftHandler, { method: 'PUT', query, body: createDefaultGuestMenuDocument({ title: 'hijacked' }) }),
        callAs(owner, publishHandler, { method: 'POST', query }),
        callAs(owner, unpublishHandler, { method: 'POST', query }),
        callAs(owner, duplicateHandler, { method: 'POST', query, body: {} }),
        callAs(owner, previewTokenRegenerateHandler, { method: 'POST', query }),
        callAs(owner, itemHandler, { method: 'DELETE', query }),
      ];
      for (const result of await Promise.all(calls)) expect(result.status).toBe(404);

      expect(await snapshotGuestMenu(foreign.id)).toEqual(before);
      expect(await prisma.guestMenu.count({ where: { workspaceId: a.workspace.id } })).toBe(0);
      expect(await prisma.auditLog.count()).toBe(0);
    });

    it("rejects tenant B's card as sourceCardId (create and update) without writing", async () => {
      const { a, b } = await seedTenantPair();
      const manager = roleUser(a, 'MANAGER');
      const foreignCard = await seedCard(b.workspace.id);
      const workspaceId = a.workspace.id;

      const created = await callAs(manager, collectionHandler, { method: 'POST', query: { workspaceId }, body: { name: 'X', sourceCardId: foreignCard.id } });
      expect(created.status).toBe(400);
      expect(errorCodeOf(created)).toBe('INVALID_REFERENCE');
      expect(await prisma.guestMenu.count()).toBe(0);

      const own = await seedGuestMenu(workspaceId);
      const before = await snapshotGuestMenu(own.id);
      const patched = await callAs(manager, itemHandler, {
        method: 'PATCH',
        query: { workspaceId, menuId: own.id },
        body: { name: 'changed', sourceCardId: foreignCard.id },
      });
      expect(patched.status).toBe(400);
      expect(errorCodeOf(patched)).toBe('INVALID_REFERENCE');
      expect(await snapshotGuestMenu(own.id)).toEqual(before);
    });

    it("rejects tenant B's menu ids in a reorder without changing any priority", async () => {
      const { a, b } = await seedTenantPair();
      const own = await seedGuestMenu(a.workspace.id, { priority: 0 });
      const foreign = await seedGuestMenu(b.workspace.id, { priority: 7 });
      const result = await callAs(roleUser(a, 'MANAGER'), reorderHandler, {
        method: 'PUT',
        query: { workspaceId: a.workspace.id },
        body: { menuIds: [foreign.id, own.id] },
      });
      expect(result.status).toBe(404);
      expect((await prisma.guestMenu.findUniqueOrThrow({ where: { id: own.id } })).priority).toBe(0);
      expect((await prisma.guestMenu.findUniqueOrThrow({ where: { id: foreign.id } })).priority).toBe(7);
    });

    it("rejects tenant B's template id on update and delete", async () => {
      const { a, b } = await seedTenantPair();
      const foreign = await seedGuestMenuTemplate(b.workspace.id, 'foreign template');
      const query = { workspaceId: a.workspace.id, templateId: foreign.id };
      const body = { name: 'hijacked', definition: { schemaVersion: 1, baseTemplateId: 'classic', slots: {} } };
      const owner = roleUser(a, 'OWNER');

      expect((await callAs(owner, templatesItemHandler, { method: 'PUT', query, body })).status).toBe(404);
      expect((await callAs(owner, templatesItemHandler, { method: 'DELETE', query })).status).toBe(404);
      expect(await prisma.guestMenuTemplate.findUniqueOrThrow({ where: { id: foreign.id } })).toMatchObject({ name: 'foreign template' });
    });
  });

  describe('authorization', () => {
    it('denies USER sessions and read-only API keys for writes', async () => {
      const { a } = await seedTenantPair();
      const workspaceId = a.workspace.id;
      const readKey = await seedApiKey(workspaceId, roleUser(a, 'OWNER').user.id, ['GUEST_MENUS_READ']);

      const asUser = await callAs(roleUser(a, 'USER'), collectionHandler, { method: 'POST', query: { workspaceId }, body: { name: 'X' } });
      expect(asUser.status).toBe(403);
      const asReadKey = await callAs({ apiKeyJwt: readKey.jwt }, collectionHandler, { method: 'POST', query: { workspaceId }, body: { name: 'X' } });
      expect(asReadKey.status).toBe(403);

      const menu = await seedGuestMenu(workspaceId);
      const publishWithReadKey = await callAs({ apiKeyJwt: readKey.jwt }, publishHandler, { method: 'POST', query: { workspaceId, menuId: menu.id } });
      expect(publishWithReadKey.status).toBe(403);
      expect(await prisma.guestMenu.count()).toBe(1);
    });
  });

  describe('concurrency', () => {
    it('gives concurrent creates unique slugs and priorities', async () => {
      const { a } = await seedTenantPair();
      const manager = roleUser(a, 'MANAGER');
      const results = await Promise.all(
        Array.from({ length: 10 }, () =>
          callAs(manager, collectionHandler, { method: 'POST', query: { workspaceId: a.workspace.id }, body: { name: 'Karte' } }),
        ),
      );
      expect(results.map((result) => result.status)).toEqual(Array(10).fill(201));
      const menus = await prisma.guestMenu.findMany({ where: { workspaceId: a.workspace.id } });
      expect(new Set(menus.map((menu) => menu.slug)).size).toBe(10);
      expect(menus.map((menu) => menu.priority).sort((x, y) => x - y)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });

    it('lets exactly one of concurrent creates with the same slug win (409 SLUG_TAKEN for the rest)', async () => {
      const { a } = await seedTenantPair();
      const manager = roleUser(a, 'MANAGER');
      const results = await Promise.all(
        Array.from({ length: 8 }, (_, index) =>
          callAs(manager, collectionHandler, { method: 'POST', query: { workspaceId: a.workspace.id }, body: { name: `Karte ${index}`, slug: 'bar' } }),
        ),
      );
      expect(results.filter((result) => result.status === 201)).toHaveLength(1);
      const conflicts = results.filter((result) => result.status === 409);
      expect(conflicts).toHaveLength(7);
      expect(conflicts.every((result) => errorCodeOf(result) === 'SLUG_TAKEN')).toBe(true);
      expect(await prisma.guestMenu.count({ where: { workspaceId: a.workspace.id } })).toBe(1);
      expect(await prisma.auditLog.count({ where: { workspaceId: a.workspace.id } })).toBe(1);
    });

    it('keeps a single default menu under concurrent "make default" calls', async () => {
      const { a } = await seedTenantPair();
      const manager = roleUser(a, 'MANAGER');
      const menus = await Promise.all(Array.from({ length: 6 }, (_, index) => seedGuestMenu(a.workspace.id, { priority: index })));
      const results = await Promise.all(
        menus.map((menu) =>
          callAs(manager, itemHandler, { method: 'PATCH', query: { workspaceId: a.workspace.id, menuId: menu.id }, body: { isDefault: true } }),
        ),
      );
      expect(results.map((result) => result.status)).toEqual(Array(6).fill(200));
      expect(await prisma.guestMenu.count({ where: { workspaceId: a.workspace.id, isDefault: true } })).toBe(1);
    });

    it('keeps priorities unique when creating and duplicating concurrently', async () => {
      const { a } = await seedTenantPair();
      const manager = roleUser(a, 'MANAGER');
      const source = await seedGuestMenu(a.workspace.id, { priority: 0 });
      const workspaceId = a.workspace.id;
      const results = await Promise.all([
        ...Array.from({ length: 5 }, () => callAs(manager, duplicateHandler, { method: 'POST', query: { workspaceId, menuId: source.id }, body: {} })),
        ...Array.from({ length: 5 }, () => callAs(manager, collectionHandler, { method: 'POST', query: { workspaceId }, body: { name: 'Neu' } })),
      ]);
      expect(results.map((result) => result.status)).toEqual(Array(10).fill(201));
      const priorities = (await prisma.guestMenu.findMany({ where: { workspaceId } })).map((menu) => menu.priority).sort((x, y) => x - y);
      expect(priorities).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });

    it('does not publish a draft that was saved while publishing (409 CONFLICT)', async () => {
      const { a } = await seedTenantPair();
      const manager = roleUser(a, 'MANAGER');
      const menu = await seedGuestMenu(a.workspace.id);
      publishHook.duringValidation = async () => {
        publishHook.duringValidation = null;
        const saved = await callAs(manager, draftHandler, {
          method: 'PUT',
          query: { workspaceId: a.workspace.id, menuId: menu.id },
          body: createDefaultGuestMenuDocument({ title: 'newer draft' }),
        });
        expect(saved.status).toBe(200);
      };
      try {
        const result = await callAs(manager, publishHandler, { method: 'POST', query: { workspaceId: a.workspace.id, menuId: menu.id } });
        expect(result.status).toBe(409);
        expect(errorCodeOf(result)).toBe('CONFLICT');
      } finally {
        publishHook.duringValidation = null;
      }
      const row = await prisma.guestMenu.findUniqueOrThrow({ where: { id: menu.id } });
      expect(row.published).toBeNull();
      expect(await prisma.auditLog.count({ where: { entityId: menu.id } })).toBe(0);

      // A retry publishes the newer draft.
      const retry = await callAs(manager, publishHandler, { method: 'POST', query: { workspaceId: a.workspace.id, menuId: menu.id } });
      expect(retry.status).toBe(200);
      expect(JSON.stringify((await prisma.guestMenu.findUniqueOrThrow({ where: { id: menu.id } })).published)).toContain('newer draft');
    });
  });

  describe('validation', () => {
    it('rejects duplicate ids in a reorder', async () => {
      const { a } = await seedTenantPair();
      const menu = await seedGuestMenu(a.workspace.id);
      const result = await callAs(roleUser(a, 'MANAGER'), reorderHandler, {
        method: 'PUT',
        query: { workspaceId: a.workspace.id },
        body: { menuIds: [menu.id, menu.id] },
      });
      expect(result.status).toBe(400);
    });
  });
});
