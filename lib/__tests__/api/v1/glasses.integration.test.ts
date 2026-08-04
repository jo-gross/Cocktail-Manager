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
import { findUserByRole, seedGlass, seedWorkspace } from '@test/helpers/dbFixtures';
import { GlassDtoSchema } from '@lib/schemas/glasses';

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
  });
});
