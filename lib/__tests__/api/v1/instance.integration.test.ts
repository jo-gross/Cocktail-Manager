/**
 * Instance API (`/api/v1/instance/**`): master key only, instance-wide inventory for the control plane.
 * Responses are checked against the documented schemas, which follow the control plane contract.
 */
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { Prisma } from '@generated/prisma/client';
import prisma from '../../../../prisma/prisma';
import { createDefaultGuestMenuDocument } from '@lib/guest-menu/schema';
import { instanceHandler, usersCollectionHandler, workspacesCollectionHandler, workspacesItemHandler } from '@lib/api/v1/instance';
import { itemHandler as usersItemHandler } from '@lib/api/v1/workspaceUsers';
import {
  InstanceInfoSchema,
  InstanceUserSchema,
  InstanceWorkspaceDetailSchema,
  InstanceWorkspaceSummarySchema,
  type InstanceUserDto,
  type InstanceWorkspaceDetailDto,
  type InstanceWorkspaceSummaryDto,
} from '@lib/schemas/instance';
import { encodeWorkspaceCursor } from '@lib/instance/cursor';
import { bearerToken, sessionCookie } from '@test/helpers/authFixtures';
import { findUserByRole, seedApiKey, seedCocktail, seedGlass, seedWorkspace, type SeededWorkspace } from '@test/helpers/dbFixtures';
import { callAs, dataOf, errorCodeOf, roleUser } from '@test/helpers/scenario';
import type { HandlerResult } from '@test/helpers/invokeHandler';

type Page = { data: InstanceWorkspaceSummaryDto[]; pagination: { nextCursor: string | null } };

const listWorkspaces = (query: Record<string, string> = {}) => callAs('master', workspacesCollectionHandler, { method: 'GET', query });
const getWorkspace = (id: string) => callAs('master', workspacesItemHandler, { method: 'GET', query: { id } });
const searchUsers = (query: Record<string, string> = {}) => callAs('master', usersCollectionHandler, { method: 'GET', query });

function pageOf(result: HandlerResult): Page {
  expect(result.status, JSON.stringify(result.json)).toBe(200);
  const page = result.json as Page;
  for (const item of page.data) InstanceWorkspaceSummarySchema.strict().parse(item);
  return page;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const suffix = () => randomBytes(4).toString('hex');

async function seedUsage(seeded: SeededWorkspace) {
  const workspaceId = seeded.workspace.id;
  const owner = findUserByRole(seeded, 'OWNER');
  const glass = await seedGlass(workspaceId);
  await seedCocktail(workspaceId, glass.id);
  await seedCocktail(workspaceId, glass.id);
  const archived = await seedCocktail(workspaceId, glass.id);
  await prisma.cocktailRecipe.update({ where: { id: archived.id }, data: { isArchived: true } });
  await prisma.cocktailCalculation.create({ data: { name: 'Party', workspaceId, updatedByUserId: owner.user.id } });
  const document = createDefaultGuestMenuDocument() as unknown as Prisma.InputJsonValue;
  await prisma.guestMenu.create({
    data: { workspaceId, name: 'Published', slug: `p-${suffix()}`, draft: document, published: document, publishedAt: new Date() },
  });
  await prisma.guestMenu.create({ data: { workspaceId, name: 'Draft', slug: `d-${suffix()}`, draft: document } });
  await prisma.signage.create({ data: { workspaceId, format: 'LANDSCAPE' } });
  await prisma.signage.create({ data: { workspaceId, format: 'PORTRAIT' } });
  await seedApiKey(workspaceId, owner.user.id, ['COCKTAILS_READ'], 'active');
  const revoked = await seedApiKey(workspaceId, owner.user.id, ['COCKTAILS_READ'], 'revoked');
  await prisma.workspaceApiKey.update({ where: { id: revoked.recordId }, data: { revoked: true } });
  const expired = await seedApiKey(workspaceId, owner.user.id, ['COCKTAILS_READ'], 'expired');
  await prisma.workspaceApiKey.update({ where: { id: expired.recordId }, data: { expiresAt: new Date(Date.now() - 60_000) } });
}

describe('GET /api/v1/instance', () => {
  it('reports version, capabilities, mode, readiness and counts', async () => {
    await seedWorkspace({ users: [{ role: 'OWNER' }, { role: 'USER' }] });
    await seedWorkspace({ users: [{ role: 'OWNER' }] });
    await prisma.workspace.create({ data: { name: 'Demo', isDemo: true } });

    const result = await callAs('master', instanceHandler, { method: 'GET', headers: { 'x-cm-actor': 'admin@example.test' } });
    expect(result.status).toBe(200);
    const info = InstanceInfoSchema.strict().parse(dataOf(result));
    expect(info).toMatchObject({
      apiVersion: '1',
      capabilities: ['instance.read'],
      entitlementsMode: 'off',
      migrationsReady: true,
      counts: { workspaces: 2, users: 3 },
    });
    expect(info.appVersion).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('reads ENTITLEMENTS_MODE and treats invalid values as off', async () => {
    const original = process.env.ENTITLEMENTS_MODE;
    try {
      process.env.ENTITLEMENTS_MODE = 'managed';
      expect(dataOf<{ entitlementsMode: string }>(await callAs('master', instanceHandler, { method: 'GET' })).entitlementsMode).toBe('managed');
      process.env.ENTITLEMENTS_MODE = 'bogus';
      expect(dataOf<{ entitlementsMode: string }>(await callAs('master', instanceHandler, { method: 'GET' })).entitlementsMode).toBe('off');
    } finally {
      if (original === undefined) delete process.env.ENTITLEMENTS_MODE;
      else process.env.ENTITLEMENTS_MODE = original;
    }
  });
});

describe('master key only', () => {
  const handlers = [
    ['instance', instanceHandler, {}],
    ['workspaces', workspacesCollectionHandler, {}],
    ['workspace', workspacesItemHandler, { id: 'any' }],
    ['users', usersCollectionHandler, {}],
  ] as const;

  it('answers 401 without a key, with a wrong key, with a session and with a workspace API key', async () => {
    const seeded = await seedWorkspace({ users: [{ role: 'OWNER' }] });
    const owner = findUserByRole(seeded, 'OWNER');
    const apiKey = await seedApiKey(seeded.workspace.id, owner.user.id, ['WORKSPACE_READ', 'COCKTAILS_READ']);

    for (const [name, handler, query] of handlers) {
      for (const [who, headers] of [
        ['no key', {}],
        ['wrong key', bearerToken('ck_master_wrong')],
        ['owner session', sessionCookie(owner.sessionToken)],
        ['workspace api key', bearerToken(apiKey.jwt)],
      ] as const) {
        const result = await callAs('anonymous', handler, { method: 'GET', query: { ...query }, headers: { ...headers } });
        expect(result.status, `${name} with ${who}`).toBe(401);
        expect(errorCodeOf(result), `${name} with ${who}`).toBe('UNAUTHORIZED');
      }
    }
  });

  it('answers 401 when INSTANCE_MASTER_API_KEY is not configured', async () => {
    const original = process.env.INSTANCE_MASTER_API_KEY;
    try {
      delete process.env.INSTANCE_MASTER_API_KEY;
      expect((await callAs('master', instanceHandler, { method: 'GET' })).status).toBe(401);
    } finally {
      process.env.INSTANCE_MASTER_API_KEY = original;
    }
  });

  it('answers 405 for methods the read stage does not serve', async () => {
    const seeded = await seedWorkspace({ users: [{ role: 'OWNER' }] });
    expect((await callAs('master', workspacesItemHandler, { method: 'DELETE', query: { id: seeded.workspace.id } })).status).toBe(405);
    expect(await prisma.workspace.count({ where: { id: seeded.workspace.id } })).toBe(1);
  });
});

describe('GET /api/v1/instance/workspaces', () => {
  it('lists summaries with owner, members, last activity and usage from grouped counts', async () => {
    const seeded = await seedWorkspace({ name: 'Usage Bar', users: [{ role: 'OWNER', email: 'owner@usage.test', name: 'Olga Owner' }, { role: 'USER' }] });
    await seedUsage(seeded);
    const lastOpened = new Date('2026-03-01T10:00:00.000Z');
    await prisma.workspaceUser.update({
      where: { workspaceId_userId: { workspaceId: seeded.workspace.id, userId: roleUser(seeded, 'USER').user.id } },
      data: { lastOpened },
    });
    await prisma.auditLog.create({
      data: { workspaceId: seeded.workspace.id, entityType: 'Cocktail', entityId: 'x', action: 'UPDATE', createdAt: new Date('2026-02-01T10:00:00.000Z') },
    });
    const empty = await seedWorkspace({ name: 'Empty Bar', users: [] });

    const page = pageOf(await listWorkspaces());
    const usageBar = page.data.find((item) => item.id === seeded.workspace.id)!;
    expect(usageBar).toMatchObject({
      name: 'Usage Bar',
      owner: { id: findUserByRole(seeded, 'OWNER').user.id, email: 'owner@usage.test', name: 'Olga Owner' },
      memberCount: 2,
      lastActivityAt: lastOpened.toISOString(),
      usage: { cocktails: 2, members: 2, calculations: 1, guestMenusPublished: 1, signageScreens: 2, apiKeys: 1 },
      entitlement: null,
    });
    expect(Date.parse(usageBar.createdAt!)).not.toBeNaN();
    expect(Date.parse(usageBar.updatedAt!)).not.toBeNaN();

    const emptyBar = page.data.find((item) => item.id === empty.workspace.id)!;
    expect(emptyBar).toMatchObject({
      owner: null,
      memberCount: 0,
      lastActivityAt: null,
      usage: { cocktails: 0, members: 0, calculations: 0, guestMenusPublished: 0, signageScreens: 0, apiKeys: 0 },
    });
  });

  it('pages through every workspace with an opaque cursor', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) ids.push((await seedWorkspace({ name: `Page Bar ${i}`, users: [{ role: 'OWNER' }] })).workspace.id);

    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const page: Page = pageOf(await listWorkspaces({ limit: '2', ...(cursor ? { cursor } : {}) }));
      expect(page.data.length).toBeLessThanOrEqual(2);
      seen.push(...page.data.map((item) => item.id));
      cursor = page.pagination.nextCursor;
      pages++;
    } while (cursor && pages < 10);

    expect(pages).toBe(3);
    expect(seen).toEqual([...ids].sort());
  });

  it('keeps the cursor valid when the last workspace of a page is deleted', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) ids.push((await seedWorkspace({ users: [] })).workspace.id);
    const sorted = [...ids].sort();
    const first = pageOf(await listWorkspaces({ limit: '1' }));
    await prisma.workspace.delete({ where: { id: sorted[0] } });
    const second = pageOf(await listWorkspaces({ limit: '5', cursor: first.pagination.nextCursor! }));
    expect(second.data.map((item) => item.id)).toEqual(sorted.slice(1));
    expect(second.pagination.nextCursor).toBeNull();
  });

  it('rejects invalid cursor, limit and updatedSince with 400', async () => {
    for (const query of [{ cursor: '50' }, { limit: '0' }, { limit: '201' }, { limit: 'many' }, { updatedSince: 'yesterday' }]) {
      const result = await listWorkspaces(query);
      expect(result.status, JSON.stringify(query)).toBe(400);
      expect(errorCodeOf(result)).toBe('VALIDATION_ERROR');
    }
    // A well-formed cursor of an unknown id simply continues after it.
    expect(pageOf(await listWorkspaces({ cursor: encodeWorkspaceCursor('zzzz') })).data).toEqual([]);
  });

  it('leaves out template and demo workspaces', async () => {
    const customer = await seedWorkspace({ users: [{ role: 'OWNER' }] });
    const demo = await prisma.workspace.create({ data: { name: 'Demo', isDemo: true } });
    const template = await prisma.workspace.create({ data: { name: 'Template' } });
    await prisma.workspaceTemplate.create({
      data: { workspaceId: template.id, key: `tpl-${suffix()}`, kind: 'CATALOG', name: { de: 'V', en: 'T' }, locales: ['de'] },
    });

    expect(pageOf(await listWorkspaces()).data.map((item) => item.id)).toEqual([customer.workspace.id]);
    expect(dataOf<InstanceWorkspaceDetailDto>(await getWorkspace(demo.id)).id).toBe(demo.id);
  });

  it('searches the name and the owner email case-insensitively', async () => {
    const byName = await seedWorkspace({ name: 'Bar Zentral', users: [{ role: 'OWNER', email: 'someone@one.test' }] });
    const byOwner = await seedWorkspace({ name: 'Elsewhere', users: [{ role: 'OWNER', email: 'Zentral-Owner@two.test' }] });
    const memberOnly = await seedWorkspace({
      name: 'Third',
      users: [
        { role: 'OWNER', email: 'x@three.test' },
        { role: 'USER', email: 'zentral-user@three.test' },
      ],
    });

    const ids = pageOf(await listWorkspaces({ q: 'ZENTRAL' })).data.map((item) => item.id);
    expect(ids.sort()).toEqual([byName.workspace.id, byOwner.workspace.id].sort());
    expect(ids).not.toContain(memberOnly.workspace.id);
    expect(pageOf(await listWorkspaces({ q: 'no-match-anywhere' })).data).toEqual([]);
  });

  it('updatedSince returns workspaces whose members, roles, member names or settings changed, not content or visits', async () => {
    const a = await seedWorkspace({ name: 'A', users: [{ role: 'OWNER' }, { role: 'USER' }] });
    const b = await seedWorkspace({ name: 'B', users: [{ role: 'OWNER' }] });
    const c = await seedWorkspace({ name: 'C', users: [{ role: 'OWNER' }] });
    const d = await seedWorkspace({ name: 'D', users: [{ role: 'OWNER' }] });

    const watermark = async () => {
      const newest = await prisma.workspace.aggregate({ _max: { updatedAt: true } });
      await sleep(20);
      return new Date(newest._max.updatedAt!.getTime() + 1).toISOString();
    };
    const changedSince = async (since: string) =>
      pageOf(await listWorkspaces({ updatedSince: since }))
        .data.map((item) => item.name)
        .sort();

    let since = await watermark();
    expect(await changedSince(since)).toEqual([]);

    // Content changes and visits are not mirrored.
    const glass = await seedGlass(a.workspace.id);
    await seedCocktail(a.workspace.id, glass.id);
    await prisma.workspaceUser.update({
      where: { workspaceId_userId: { workspaceId: a.workspace.id, userId: roleUser(a, 'USER').user.id } },
      data: { lastOpened: new Date() },
    });
    expect(await changedSince(since)).toEqual([]);

    // Role change through the API.
    const promoted = await callAs(roleUser(a, 'OWNER'), usersItemHandler, {
      method: 'PUT',
      query: { workspaceId: a.workspace.id, userId: roleUser(a, 'USER').user.id },
      body: { role: 'MANAGER' },
    });
    expect(promoted.status).toBe(200);
    expect(await changedSince(since)).toEqual(['A']);

    since = await watermark();
    await prisma.workspaceSetting.create({ data: { workspaceId: b.workspace.id, setting: 'currency', value: 'EUR' } });
    await prisma.user.update({ where: { id: roleUser(c, 'OWNER').user.id }, data: { name: 'Renamed Owner' } });
    await prisma.workspace.update({ where: { id: d.workspace.id }, data: { name: 'D2' } });
    expect(await changedSince(since)).toEqual(['B', 'C', 'D2']);

    since = await watermark();
    await prisma.workspaceUser.delete({ where: { workspaceId_userId: { workspaceId: a.workspace.id, userId: roleUser(a, 'USER').user.id } } });
    expect(await changedSince(since)).toEqual(['A']);

    // The filter combines with the cursor.
    const firstPage = pageOf(await listWorkspaces({ updatedSince: new Date(0).toISOString(), limit: '3' }));
    expect(firstPage.data).toHaveLength(3);
    const rest = pageOf(await listWorkspaces({ updatedSince: new Date(0).toISOString(), limit: '3', cursor: firstPage.pagination.nextCursor! }));
    expect(rest.data).toHaveLength(1);
    expect(rest.pagination.nextCursor).toBeNull();
  });
});

describe('GET /api/v1/instance/workspaces/{id}', () => {
  it('returns members with roles, template mark, open join requests and usage', async () => {
    const seeded = await seedWorkspace({
      name: 'Detail Bar',
      users: [
        { role: 'USER', email: 'user@detail.test', name: 'Uwe' },
        { role: 'OWNER', email: 'owner@detail.test', name: 'Olga' },
        { role: 'ADMIN', email: 'admin@detail.test', name: 'Ada' },
      ],
    });
    await seedUsage(seeded);
    const applicant = await prisma.user.create({ data: { email: 'applicant@detail.test', name: 'Anna' } });
    await prisma.workspaceJoinRequest.create({ data: { workspaceId: seeded.workspace.id, userId: applicant.id } });

    const result = await getWorkspace(seeded.workspace.id);
    expect(result.status).toBe(200);
    const detail = InstanceWorkspaceDetailSchema.strict().parse(dataOf(result));
    expect(detail.members.map((member) => [member.role, member.email])).toEqual([
      ['OWNER', 'owner@detail.test'],
      ['ADMIN', 'admin@detail.test'],
      ['USER', 'user@detail.test'],
    ]);
    expect(detail.members[0]).toMatchObject({ userId: roleUser(seeded, 'OWNER').user.id, name: 'Olga', lastOpened: null });
    expect(detail).toMatchObject({
      id: seeded.workspace.id,
      name: 'Detail Bar',
      owner: { email: 'owner@detail.test' },
      memberCount: 3,
      template: null,
      usage: { cocktails: 2, members: 3, calculations: 1, guestMenusPublished: 1, signageScreens: 2, apiKeys: 1 },
      entitlement: null,
    });
    expect(detail.pendingJoinRequests).toEqual([{ userId: applicant.id, email: 'applicant@detail.test', name: 'Anna', createdAt: expect.any(String) }]);
  });

  it('reports the template key of a template workspace', async () => {
    const workspace = await prisma.workspace.create({ data: { name: 'Template' } });
    const key = `tpl-${suffix()}`;
    await prisma.workspaceTemplate.create({ data: { workspaceId: workspace.id, key, kind: 'CATALOG', name: { de: 'V', en: 'T' }, locales: ['de'] } });
    expect(dataOf<InstanceWorkspaceDetailDto>(await getWorkspace(workspace.id)).template).toEqual({ key });
  });

  it('answers 404 for an unknown workspace', async () => {
    const result = await getWorkspace('does-not-exist');
    expect(result.status).toBe(404);
    expect(errorCodeOf(result)).toBe('NOT_FOUND');
  });
});

describe('GET /api/v1/instance/users', () => {
  it('finds users by email or name with providers, memberships and active sessions', async () => {
    const first = await seedWorkspace({ name: 'Alpha', users: [{ role: 'OWNER', email: 'marta@search.test', name: 'Marta Muster' }] });
    const marta = findUserByRole(first, 'OWNER').user;
    const second = await seedWorkspace({ name: 'Beta', users: [] });
    await prisma.workspaceUser.create({ data: { workspaceId: second.workspace.id, userId: marta.id, role: 'MANAGER' } });
    await prisma.account.create({ data: { userId: marta.id, providerId: 'google', accountId: `g-${suffix()}` } });
    await prisma.account.create({ data: { userId: marta.id, providerId: 'credential', accountId: `c-${suffix()}` } });
    await prisma.session.create({ data: { userId: marta.id, token: `expired-${suffix()}`, expiresAt: new Date(Date.now() - 60_000) } });
    await prisma.user.create({ data: { email: 'other@search.test', name: 'Someone Else' } });

    for (const q of ['MARTA@search', 'muster']) {
      const result = await searchUsers({ q });
      expect(result.status).toBe(200);
      const users = dataOf<InstanceUserDto[]>(result).map((user) => InstanceUserSchema.strict().parse(user));
      expect(users).toHaveLength(1);
      expect(users[0]).toEqual({
        id: marta.id,
        email: 'marta@search.test',
        name: 'Marta Muster',
        createdAt: marta.createdAt.toISOString(),
        providers: ['credential', 'google'],
        workspaces: [
          { id: first.workspace.id, name: 'Alpha', role: 'OWNER' },
          { id: second.workspace.id, name: 'Beta', role: 'MANAGER' },
        ],
        // seedWorkspace creates one valid session; the expired one does not count.
        activeSessions: 1,
      });
    }

    expect(dataOf<InstanceUserDto[]>(await searchUsers({ q: 'nobody-matches' }))).toEqual([]);
    expect(dataOf<InstanceUserDto[]>(await searchUsers()).map((user) => user.email)).toEqual(['marta@search.test', 'other@search.test']);
  });

  it('bounds q and the number of results', async () => {
    expect((await searchUsers({ q: 'x'.repeat(201) })).status).toBe(400);
    await prisma.user.createMany({ data: Array.from({ length: 55 }, (_, i) => ({ email: `bulk-${String(i).padStart(2, '0')}@search.test`, name: 'Bulk' })) });
    expect(dataOf<InstanceUserDto[]>(await searchUsers({ q: 'bulk' }))).toHaveLength(50);
  });
});
