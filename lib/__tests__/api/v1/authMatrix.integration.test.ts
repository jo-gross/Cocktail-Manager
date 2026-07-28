import { describe, it, expect } from 'vitest';
import { flattenOperations } from '@lib/openapi/flattenOperations';
import { handlerBindings } from '@test/helpers/handlerBindings';
import { invokeHandler } from '@test/helpers/invokeHandler';
import { requestOptionsForOperation } from '@test/helpers/requestBuilder';
import { asMasterKey, minimumRequiredRole, roleBelowMinimum, sessionCookie } from '@test/helpers/authFixtures';
import { findUserByRole, seedApiKey, seedWorkspace } from '@test/helpers/dbFixtures';

describe('v1 auth matrix (integration)', () => {
  it('returns 401 for workspace operations without credentials', async () => {
    const operations = (await flattenOperations()).filter((op) => op.basePath.includes('{workspaceId}'));

    for (const op of operations.slice(0, 20)) {
      const binding = handlerBindings.find((b) => b.apiDoc.basePath === op.basePath);
      if (!binding) continue;

      const result = await invokeHandler(binding.handler, requestOptionsForOperation(op));
      expect(result.status, `${op.method} ${op.basePath}`).toBe(401);
    }
  });

  it('returns 403 for session user with insufficient role', async () => {
    const seeded = await seedWorkspace({
      users: [{ role: 'USER' }, { role: 'ADMIN' }],
    });

    const adminOnlyOps = (await flattenOperations()).filter(
      (op) => op.basePath.includes('{workspaceId}') && op.spec.roles.includes('ADMIN') && !op.spec.roles.includes('USER'),
    );

    for (const op of adminOnlyOps.slice(0, 10)) {
      const binding = handlerBindings.find((b) => b.apiDoc.basePath === op.basePath);
      if (!binding) continue;

      const user = findUserByRole(seeded, 'USER');
      const result = await invokeHandler(
        binding.handler,
        requestOptionsForOperation(op, {
          headers: sessionCookie(user.sessionToken),
          query: { workspaceId: seeded.workspace.id },
        }),
      );

      expect(result.status, `${op.method} ${op.basePath}`).toBe(403);
    }
  });

  it('returns 403 when API key lacks required permission', async () => {
    const seeded = await seedWorkspace({ users: [{ role: 'ADMIN' }] });
    const admin = findUserByRole(seeded, 'ADMIN');

    const opsWithPermission = (await flattenOperations()).filter((op) => op.basePath.includes('{workspaceId}') && op.spec.permission && !op.spec.sessionOnly);

    for (const op of opsWithPermission.slice(0, 10)) {
      const binding = handlerBindings.find((b) => b.apiDoc.basePath === op.basePath);
      if (!binding) continue;

      const apiKey = await seedApiKey(seeded.workspace.id, admin.user.id, ['WORKSPACE_READ']);
      const result = await invokeHandler(
        binding.handler,
        requestOptionsForOperation(op, {
          headers: { authorization: `Bearer ${apiKey.jwt}` },
          query: { workspaceId: seeded.workspace.id },
        }),
      );

      if (op.spec.permission === 'WORKSPACE_READ') continue;
      expect(result.status, `${op.method} ${op.basePath}`).toBe(403);
    }
  });

  it('returns 401 for sessionOnly operations when using API key', async () => {
    const seeded = await seedWorkspace({ users: [{ role: 'ADMIN' }] });
    const admin = findUserByRole(seeded, 'ADMIN');

    const sessionOnlyOps = (await flattenOperations()).filter((op) => op.spec.sessionOnly);

    for (const op of sessionOnlyOps) {
      const binding = handlerBindings.find((b) => b.apiDoc.basePath === op.basePath);
      if (!binding) continue;

      const apiKey = await seedApiKey(seeded.workspace.id, admin.user.id, ['WORKSPACE_READ', 'WORKSPACE_UPDATE']);
      const result = await invokeHandler(
        binding.handler,
        requestOptionsForOperation(op, {
          method: op.method,
          headers: { authorization: `Bearer ${apiKey.jwt}` },
          query: { workspaceId: seeded.workspace.id },
        }),
      );

      expect(result.status, `${op.method} ${op.basePath}`).toBe(401);
    }
  });

  it('allows master key for non-sessionOnly workspace operations', async () => {
    const seeded = await seedWorkspace({ users: [{ role: 'USER' }] });

    const readOps = (await flattenOperations()).filter((op) => op.basePath.includes('{workspaceId}') && !op.spec.sessionOnly && op.method === 'GET');

    for (const op of readOps.slice(0, 5)) {
      const binding = handlerBindings.find((b) => b.apiDoc.basePath === op.basePath);
      if (!binding) continue;

      const result = await invokeHandler(
        binding.handler,
        requestOptionsForOperation(op, {
          headers: asMasterKey(),
          query: { workspaceId: seeded.workspace.id },
        }),
      );

      expect(result.status, `${op.method} ${op.basePath}`).not.toBe(401);
      expect(result.status, `${op.method} ${op.basePath}`).not.toBe(403);
    }
  });

  it('GET /me returns 401 without API key', async () => {
    const binding = handlerBindings.find((b) => b.apiDoc.basePath === '/me');
    expect(binding).toBeDefined();

    const result = await invokeHandler(binding!.handler, { method: 'GET' });
    expect(result.status).toBe(401);
    expect(result.json).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
  });

  it('GET /me returns 200 with master key', async () => {
    const binding = handlerBindings.find((b) => b.apiDoc.basePath === '/me');
    const result = await invokeHandler(binding!.handler, { method: 'GET', headers: asMasterKey() });

    expect(result.status).toBe(200);
    expect(result.json).toMatchObject({ data: { isMaster: true } });
  });
});

describe('v1 auth matrix helpers', () => {
  it('minimumRequiredRole picks lowest acceptable role', () => {
    expect(minimumRequiredRole(['ADMIN'])).toBe('ADMIN');
    expect(minimumRequiredRole(['MANAGER', 'ADMIN'])).toBe('MANAGER');
  });

  it('roleBelowMinimum returns role under threshold', () => {
    expect(roleBelowMinimum(['MANAGER'])).toBe('USER');
    expect(roleBelowMinimum(['USER'])).toBeNull();
  });
});
