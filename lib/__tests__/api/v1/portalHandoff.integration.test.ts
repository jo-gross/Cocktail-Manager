/**
 * Portal handoff (docs/ENTITLEMENTS.md "Portal handoff", contract `contracts/portal-handoff.md` of the control plane):
 * owners get a signed URL, everyone else is refused, the handoff is offered only with managed mode and complete env,
 * and it stays available in a read-only or suspended workspace.
 */
import { randomUUID, generateKeyPairSync, verify, type KeyObject } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import prisma from '../../../../prisma/prisma';
import { handoffHandler } from '@lib/api/v1/portalHandoff';
import { instanceWorkspaceHandler, workspaceHandler as entitlementHandler } from '@lib/api/v1/entitlements';
import { collectionHandler as glassesHandler } from '@lib/api/v1/glasses';
import { PortalHandoffResultSchema } from '@lib/schemas/portalHandoff';
import { WorkspaceEntitlementDtoSchema } from '@lib/schemas/entitlements';
import { PERMISSION_NAMES } from '@lib/schemas/permissions';
import type { Permission } from '@generated/prisma/client';
import { snapshotWire } from '@test/helpers/entitlements';
import { seedApiKey, seedWorkspace } from '@test/helpers/dbFixtures';
import { callAs, dataOf, errorCodeOf, roleUser, seedTenantPair, type Caller } from '@test/helpers/scenario';
import type { HandlerResult } from '@test/helpers/invokeHandler';

const PORTAL_URL = 'https://portal.example.test';
const ISSUER = 'https://bar.example.test';

let privateKey: KeyObject;
let publicKey: KeyObject;

/** One-line env form with `\n`, as the backoffice prints it. */
function envLine(key: KeyObject): string {
  return `"${key.export({ format: 'pem', type: 'pkcs8' }).toString().trim().replace(/\n/g, '\\n')}"`;
}

function configure(overrides: Record<string, string> = {}) {
  vi.stubEnv('ENTITLEMENTS_MODE', 'managed');
  vi.stubEnv('PORTAL_HANDOFF_PRIVATE_KEY', envLine(privateKey));
  vi.stubEnv('PORTAL_URL', `${PORTAL_URL}/`);
  // Origin normalisation: default port, upper case and path are dropped.
  vi.stubEnv('BETTER_AUTH_URL', 'https://BAR.example.test:443/app/');
  for (const [key, value] of Object.entries(overrides)) vi.stubEnv(key, value);
}

const handoff = (caller: Caller, workspaceId: string, body: unknown = { intent: 'manage' }) =>
  callAs(caller, handoffHandler, { method: 'POST', query: { workspaceId }, body });

function tokenOf(result: HandlerResult): string {
  expect(result.status, JSON.stringify(result.json)).toBe(200);
  const { url } = PortalHandoffResultSchema.strict().parse(dataOf(result));
  const parsed = new URL(url);
  expect(`${parsed.origin}${parsed.pathname}`).toBe(`${PORTAL_URL}/sso`);
  expect([...parsed.searchParams.keys()]).toEqual(['token']);
  return parsed.searchParams.get('token')!;
}

/** Verifies the Ed25519 signature with the public key and answers header and claims. */
function verified(token: string) {
  const parts = token.split('.');
  expect(parts).toHaveLength(3);
  const [header, payload, signature] = parts;
  expect(verify(null, Buffer.from(`${header}.${payload}`), publicKey, Buffer.from(signature, 'base64url'))).toBe(true);
  return {
    header: JSON.parse(Buffer.from(header, 'base64url').toString('utf8')) as Record<string, unknown>,
    claims: JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>,
  };
}

const handoffLogs = (workspaceId: string) => prisma.auditLog.findMany({ where: { workspaceId, entityType: 'PortalHandoff' }, orderBy: { createdAt: 'asc' } });

const pushStatus = (workspaceId: string, status: 'ACTIVE' | 'GRACE' | 'READ_ONLY' | 'SUSPENDED', version = 1) =>
  callAs('master', instanceWorkspaceHandler, {
    method: 'PUT',
    query: { id: workspaceId },
    body: snapshotWire({ version, status }),
    headers: { 'x-cm-actor': 'admin@control-plane.test', 'x-cm-reason': 'test', 'idempotency-key': randomUUID() },
  });

beforeEach(() => {
  ({ privateKey, publicKey } = generateKeyPairSync('ed25519'));
  configure();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('POST /api/v1/workspaces/{workspaceId}/portal/handoff', () => {
  it('gives an owner a portal URL whose token verifies, carries every claim and expires in 120 s', async () => {
    const { workspace, users } = await seedWorkspace({ name: 'Bar Olivia', users: [{ role: 'OWNER', email: 'Olivia@Example.test', name: 'Olivia Owner' }] });
    const owner = users[0];
    await prisma.userSetting.create({ data: { userId: owner.user.id, setting: 'language', value: 'en' } });

    const before = Math.floor(Date.now() / 1000);
    const result = await handoff(owner, workspace.id, { intent: 'upgrade' });
    const after = Math.floor(Date.now() / 1000);
    const token = tokenOf(result);
    expect(result.headers['Cache-Control']).toBe('no-store');
    expect(token.length).toBeLessThan(4096);

    const { header, claims } = verified(token);
    expect(header).toEqual({ alg: 'EdDSA', typ: 'JWT' });
    expect(Object.keys(claims)).toEqual([
      'iss',
      'aud',
      'sub',
      'email',
      'email_verified',
      'name',
      'wid',
      'wname',
      'role',
      'locale',
      'intent',
      'iat',
      'exp',
      'jti',
    ]);
    expect(claims).toMatchObject({
      iss: ISSUER,
      aud: 'portal',
      sub: owner.user.id,
      email: 'Olivia@Example.test',
      email_verified: true,
      name: 'Olivia Owner',
      wid: workspace.id,
      wname: 'Bar Olivia',
      role: 'OWNER',
      locale: 'en',
      intent: 'upgrade',
    });
    expect(claims.iat).toBeGreaterThanOrEqual(before);
    expect(claims.iat).toBeLessThanOrEqual(after);
    expect(claims.exp).toBe((claims.iat as number) + 120);
    expect(claims.jti).toMatch(/^[A-Za-z0-9_-]{22}$/);

    // A fresh token per click; the language of the request wins over the stored setting.
    const second = verified(tokenOf(await handoff(owner, workspace.id, { intent: 'manage', locale: 'de' }))).claims;
    expect(second).toMatchObject({ intent: 'manage', locale: 'de' });
    expect(second.jti).not.toBe(claims.jti);

    // Audit: one entry per handoff, with the intent and without token or jti.
    const logs = await handoffLogs(workspace.id);
    expect(logs).toHaveLength(2);
    expect(logs[0]).toMatchObject({
      userId: owner.user.id,
      entityId: workspace.id,
      action: 'CREATE',
      snapshot: { event: 'portal handoff', intent: 'upgrade', locale: 'en' },
    });
    const stored = JSON.stringify(logs);
    for (const secret of [token, token.split('.')[2], claims.jti as string, second.jti as string]) expect(stored).not.toContain(secret);
  });

  it('uses German without a language setting and an empty name for users without one', async () => {
    const { workspace, users } = await seedWorkspace({ users: [{ role: 'OWNER' }] });
    await prisma.user.update({ where: { id: users[0].user.id }, data: { name: null } });
    const { claims } = verified(tokenOf(await handoff(users[0], workspace.id)));
    expect(claims).toMatchObject({ locale: 'de', name: '', intent: 'manage' });
  });

  it('refuses ADMIN, MANAGER and USER', async () => {
    const { a } = await seedTenantPair();
    for (const role of ['ADMIN', 'MANAGER', 'USER'] as const) {
      const result = await handoff(roleUser(a, role), a.workspace.id);
      expect(result.status, role).toBe(403);
      expect(JSON.stringify(result.json)).not.toContain('token');
    }
    expect(await handoffLogs(a.workspace.id)).toHaveLength(0);
  });

  it('refuses an owner whose email is not verified, or who has no email', async () => {
    const { workspace, users } = await seedWorkspace({ users: [{ role: 'OWNER' }] });
    const owner = users[0];
    await prisma.user.update({ where: { id: owner.user.id }, data: { emailVerified: false } });
    let result = await handoff(owner, workspace.id);
    expect(result.status).toBe(403);
    expect(errorCodeOf(result)).toBe('EMAIL_NOT_VERIFIED');

    await prisma.user.update({ where: { id: owner.user.id }, data: { emailVerified: true, email: null } });
    result = await handoff(owner, workspace.id);
    expect(result.status).toBe(403);
    expect(errorCodeOf(result)).toBe('EMAIL_NOT_VERIFIED');
    expect(await handoffLogs(workspace.id)).toHaveLength(0);
  });

  it('refuses workspace API keys, the master key and anonymous callers', async () => {
    const { workspace, users } = await seedWorkspace({ users: [{ role: 'OWNER' }] });
    const key = await seedApiKey(workspace.id, users[0].user.id, PERMISSION_NAMES as Permission[]);
    for (const caller of [{ apiKeyJwt: key.jwt }, 'master', 'anonymous'] as const) {
      const result = await handoff(caller, workspace.id);
      expect(result.status, String(caller)).toBe(401);
    }
    expect(await handoffLogs(workspace.id)).toHaveLength(0);
  });

  it("refuses an owner for another tenant's workspace", async () => {
    const { a, b } = await seedTenantPair();
    const result = await handoff(roleUser(a, 'OWNER'), b.workspace.id);
    expect(result.status).toBe(403);
    expect(await handoffLogs(b.workspace.id)).toHaveLength(0);
  });

  it('validates the intent and the locale', async () => {
    const { workspace, users } = await seedWorkspace({ users: [{ role: 'OWNER' }] });
    for (const body of [{}, { intent: 'cancel' }, { intent: 'manage', locale: 'fr' }, { intent: 'manage', returnUrl: 'https://evil.test' }]) {
      const result = await handoff(users[0], workspace.id, body);
      if ('returnUrl' in body) {
        // Unknown members are ignored; there is no open redirect.
        expect(new URL(PortalHandoffResultSchema.parse(dataOf(result)).url).origin).toBe(PORTAL_URL);
      } else {
        expect(result.status, JSON.stringify(body)).toBe(400);
      }
    }
  });

  it('is offered only with ENTITLEMENTS_MODE=managed and complete env', async () => {
    const { workspace, users } = await seedWorkspace({ users: [{ role: 'OWNER' }] });
    const owner = users[0];
    const plan = async () =>
      WorkspaceEntitlementDtoSchema.strict().parse(dataOf(await callAs(owner, entitlementHandler, { method: 'GET', query: { workspaceId: workspace.id } })));

    expect((await plan()).portalHandoff).toBe(true);

    const cases: Array<[string, Record<string, string>]> = [
      ['mode off', { ENTITLEMENTS_MODE: 'off' }],
      ['mode unset', { ENTITLEMENTS_MODE: '' }],
      ['no key', { PORTAL_HANDOFF_PRIVATE_KEY: '' }],
      ['no portal URL', { PORTAL_URL: '' }],
      ['invalid key', { PORTAL_HANDOFF_PRIVATE_KEY: 'not a key' }],
    ];
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    for (const [label, overrides] of cases) {
      configure(overrides);
      const result = await handoff(owner, workspace.id);
      expect(result.status, label).toBe(404);
      expect(errorCodeOf(result), label).toBe('PORTAL_HANDOFF_UNAVAILABLE');
      expect((await plan()).portalHandoff, label).toBe(false);
    }
    for (const [message] of warn.mock.calls) expect(String(message)).not.toContain('not a key');
    warn.mockRestore();
    expect(await handoffLogs(workspace.id)).toHaveLength(0);
  });

  it('stays available in READ_ONLY and SUSPENDED, where other writes are refused', async () => {
    const { workspace, users } = await seedWorkspace({ users: [{ role: 'OWNER' }] });
    const owner = users[0];

    expect((await pushStatus(workspace.id, 'READ_ONLY', 1)).status).toBe(200);
    const write = await callAs(owner, glassesHandler, { method: 'POST', query: { workspaceId: workspace.id }, body: { name: 'Coupe', deposit: 0 } });
    expect(errorCodeOf(write)).toBe('WORKSPACE_READ_ONLY');
    expect(verified(tokenOf(await handoff(owner, workspace.id))).claims.wid).toBe(workspace.id);

    expect((await pushStatus(workspace.id, 'SUSPENDED', 2)).status).toBe(200);
    expect(verified(tokenOf(await handoff(owner, workspace.id, { intent: 'upgrade' }))).claims.intent).toBe('upgrade');
    expect(await handoffLogs(workspace.id)).toHaveLength(2);
  });
});
