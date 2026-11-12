import { describe, it, expect } from 'vitest';
import type { Permission, Role } from '@generated/prisma/client';
import { flattenOperations, type FlatOperation } from '@lib/openapi/flattenOperations';
import { PERMISSION_NAMES } from '@lib/schemas/permissions';
import { handlerBindings } from '@test/helpers/handlerBindings';
import { invokeHandler, type HandlerResult } from '@test/helpers/invokeHandler';
import { requestOptionsForOperation } from '@test/helpers/requestBuilder';
import { asMasterKey, bearerToken, minimumRequiredRole, roleBelowMinimum, sessionCookie } from '@test/helpers/authFixtures';
import { findUserByRole, seedApiKey, seedWorkspace } from '@test/helpers/dbFixtures';

/**
 * Expectations are derived from the specs (flattenOperations), never hardcoded per route, so the
 * matrix follows permission/role changes automatically. Each test collects every mismatch and
 * asserts the list is empty, so a failure names all offending operations at once.
 */

const label = (op: FlatOperation) => `${op.method} ${op.basePath}`;

async function workspaceOperations(): Promise<FlatOperation[]> {
  return (await flattenOperations()).filter((op) => op.basePath.includes('{workspaceId}'));
}

function bindingFor(op: FlatOperation) {
  return handlerBindings.find((b) => b.apiDoc.basePath === op.basePath && op.method in b.apiDoc.operations);
}

function call(op: FlatOperation, workspaceId: string, headers: Record<string, string>): Promise<HandlerResult> {
  const binding = bindingFor(op);
  if (!binding) throw new Error(`No handler binding for ${label(op)}`);
  return invokeHandler(binding.handler, requestOptionsForOperation(op, { headers, query: { workspaceId } }));
}

function describeResult(result: HandlerResult): string {
  return `${result.status} ${JSON.stringify(result.json)?.slice(0, 160)}`;
}

describe('v1 auth matrix (integration)', () => {
  it('has a handler binding for every workspace operation', async () => {
    const missing = (await workspaceOperations()).filter((op) => !bindingFor(op)).map(label);
    expect(missing).toEqual([]);
  });

  it('every workspace operation requires an API-key permission unless it is session-only', async () => {
    const open = (await workspaceOperations()).filter((op) => op.spec.permission === null && !op.spec.sessionOnly).map(label);
    expect(open).toEqual([]);
  });

  it('write operations never accept a *_READ scope', async () => {
    const offending = (await workspaceOperations())
      .filter((op) => op.method !== 'GET' && op.spec.permission?.endsWith('_READ'))
      // Exception: exports are reads that take their selection as a POST body.
      .filter((op) => !(op.method === 'POST' && op.basePath.includes('/export/')))
      .map((op) => `${label(op)} (${op.spec.permission})`);
    expect(offending).toEqual([]);
  });

  it('returns 401 for every workspace operation without credentials', async () => {
    const seeded = await seedWorkspace({ users: [{ role: 'OWNER' }] });
    const failures: string[] = [];

    for (const op of await workspaceOperations()) {
      if (!bindingFor(op)) continue;
      const result = await call(op, seeded.workspace.id, {});
      if (result.status !== 401) failures.push(`${label(op)} → ${describeResult(result)}`);
    }

    expect(failures).toEqual([]);
  });

  it('returns 403 for every operation when the session role is below the minimum', async () => {
    const seeded = await seedWorkspace({ users: (['USER', 'MANAGER', 'ADMIN', 'OWNER'] as Role[]).map((role) => ({ role })) });
    const failures: string[] = [];
    let checked = 0;

    for (const op of await workspaceOperations()) {
      if (!bindingFor(op)) continue;
      const below = roleBelowMinimum(op.spec.roles);
      if (!below) continue;
      checked++;
      const result = await call(op, seeded.workspace.id, sessionCookie(findUserByRole(seeded, below).sessionToken));
      if (result.status !== 403) failures.push(`${label(op)} as ${below} (min ${minimumRequiredRole(op.spec.roles)}) → ${describeResult(result)}`);
    }

    expect(checked).toBeGreaterThan(0);
    expect(failures).toEqual([]);
  });

  it('returns 403 for every operation when the API key has every permission except the required one', async () => {
    const seeded = await seedWorkspace({ users: [{ role: 'OWNER' }] });
    const owner = findUserByRole(seeded, 'OWNER');
    const failures: string[] = [];
    const keys = new Map<Permission, string>();

    for (const op of await workspaceOperations()) {
      if (!bindingFor(op) || !op.spec.permission || op.spec.sessionOnly) continue;
      const required = op.spec.permission;
      if (!keys.has(required)) {
        const others = (PERMISSION_NAMES as Permission[]).filter((permission) => permission !== required);
        keys.set(required, (await seedApiKey(seeded.workspace.id, owner.user.id, others, `all-but-${required}`)).jwt);
      }
      const result = await call(op, seeded.workspace.id, bearerToken(keys.get(required)!));
      if (result.status !== 403) failures.push(`${label(op)} without ${required} → ${describeResult(result)}`);
    }

    expect(failures).toEqual([]);
  });

  it('passes authorization for every operation when the API key has exactly the required permission', async () => {
    const seeded = await seedWorkspace({ users: [{ role: 'ADMIN' }] });
    const admin = findUserByRole(seeded, 'ADMIN');
    const failures: string[] = [];
    const keys = new Map<Permission, string>();

    for (const op of await workspaceOperations()) {
      if (!bindingFor(op) || !op.spec.permission || op.spec.sessionOnly) continue;
      const required = op.spec.permission;
      if (!keys.has(required)) keys.set(required, (await seedApiKey(seeded.workspace.id, admin.user.id, [required], `only-${required}`)).jwt);
      const result = await call(op, seeded.workspace.id, bearerToken(keys.get(required)!));
      // Placeholder ids/bodies make handlers answer 400/404 — anything but an auth rejection is fine.
      const authRejected = result.status === 401 || (result.status === 403 && /permission|not permitted|not valid/i.test(JSON.stringify(result.json)));
      if (authRejected) failures.push(`${label(op)} with ${required} → ${describeResult(result)}`);
    }

    expect(failures).toEqual([]);
  });

  it('rejects workspace API keys and the master key for every sessionOnly operation', async () => {
    const seeded = await seedWorkspace({ users: [{ role: 'OWNER' }] });
    const owner = findUserByRole(seeded, 'OWNER');
    const allPermissions = await seedApiKey(seeded.workspace.id, owner.user.id, PERMISSION_NAMES as Permission[]);
    const failures: string[] = [];
    let checked = 0;

    for (const op of await workspaceOperations()) {
      if (!bindingFor(op) || !op.spec.sessionOnly) continue;
      checked++;
      for (const [who, headers] of [
        ['api key', bearerToken(allPermissions.jwt)],
        ['master key', asMasterKey()],
      ] as const) {
        const result = await call(op, seeded.workspace.id, headers);
        if (result.status !== 401) failures.push(`${label(op)} with ${who} → ${describeResult(result)}`);
      }
    }

    expect(checked).toBeGreaterThan(0);
    expect(failures).toEqual([]);
  });

  it('allows the master key for non-sessionOnly workspace read operations', async () => {
    const seeded = await seedWorkspace({ users: [{ role: 'USER' }] });
    const failures: string[] = [];

    for (const op of await workspaceOperations()) {
      if (!bindingFor(op) || op.spec.sessionOnly || op.method !== 'GET') continue;
      const result = await call(op, seeded.workspace.id, asMasterKey());
      if (result.status === 401 || result.status === 403) failures.push(`${label(op)} → ${describeResult(result)}`);
    }

    expect(failures).toEqual([]);
  });

  it('rejects an API key of another workspace for every operation with a permission', async () => {
    const seeded = await seedWorkspace({ users: [{ role: 'OWNER' }] });
    const other = await seedWorkspace({ users: [{ role: 'OWNER' }] });
    const foreignKey = await seedApiKey(other.workspace.id, findUserByRole(other, 'OWNER').user.id, PERMISSION_NAMES as Permission[]);
    const failures: string[] = [];

    for (const op of await workspaceOperations()) {
      if (!bindingFor(op) || !op.spec.permission || op.spec.sessionOnly) continue;
      const result = await call(op, seeded.workspace.id, bearerToken(foreignKey.jwt));
      if (result.status !== 403) failures.push(`${label(op)} → ${describeResult(result)}`);
    }

    expect(failures).toEqual([]);
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

  it('GET /me reports the permissions stored in the database, not the token claims', async () => {
    const seeded = await seedWorkspace({ users: [{ role: 'ADMIN' }] });
    const admin = findUserByRole(seeded, 'ADMIN');
    const key = await seedApiKey(seeded.workspace.id, admin.user.id, ['GLASSES_READ']);
    const { default: prisma } = await import('../../../../prisma/prisma');
    await prisma.apiKeyPermission.create({ data: { apiKeyId: key.recordId, permission: 'GLASSES_CREATE' } });

    const binding = handlerBindings.find((b) => b.apiDoc.basePath === '/me');
    const result = await invokeHandler(binding!.handler, { method: 'GET', headers: bearerToken(key.jwt) });

    expect(result.status).toBe(200);
    expect((result.json as { data: { permissions: string[] } }).data.permissions.sort()).toEqual(['GLASSES_CREATE', 'GLASSES_READ']);
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
