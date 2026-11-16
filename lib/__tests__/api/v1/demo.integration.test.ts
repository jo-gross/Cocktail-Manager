import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import createWorkspaceHandler from '../../../../pages/api/demo/create-workspace';
import demoLoginHandler from '../../../../pages/api/auth/demo-login';
import cleanupHandler from '../../../../pages/api/demo/cleanup';
import demoConfigHandler from '../../../../pages/api/config/demo';
import { itemHandler as workspaceItemHandler } from '@lib/api/v1/workspace';
import { createDemoLoginToken, DEMO_LOGIN_TOKEN_TTL_MS, verifyDemoLoginToken } from '@lib/demo/loginToken';
import { deleteDemoWorkspace } from '@lib/demo/cleanup';
import { ensureBuiltInTemplates } from '@lib/templates/sync';
import { auth } from '@lib/auth';
import { markWorkspaceAsTemplate } from '@lib/api/controllers/adminTemplates';
import { loadPublicMenu } from '@lib/guest-menu/public.server';
import { parseContentLocales } from '@lib/workspace/workspaceLocaleSettings';
import prisma from '../../../../prisma/prisma';
import { createMockRequest, createMockResponse, type ApiHandler, type MockRequestOptions } from '@test/helpers/invokeHandler';
import { asMasterKey, bearerToken, sessionCookie } from '@test/helpers/authFixtures';
import { errorCodeOf } from '@test/helpers/scenario';
import { seedWorkspace } from '@test/helpers/dbFixtures';

const CLEANUP_SECRET = 'demo-cleanup-test-secret';
let ipCounter = 0;

/** Each call comes from its own client IP unless one is given (the endpoints are rate-limited per IP). */
async function invoke(handler: ApiHandler, options: MockRequestOptions, ip = `198.51.100.${++ipCounter}`) {
  const req = createMockRequest(options);
  (req as unknown as { socket: { remoteAddress: string } }).socket = { remoteAddress: ip };
  const res = createMockResponse();
  await handler(req, res);
  return res._result;
}

interface CreatedDemo {
  workspaceId: string;
  userId: string;
  expiresAt: string;
  loginToken: string;
  mode: string;
}

async function createDemo(ip?: string, body?: Record<string, unknown>) {
  const result = await invoke(createWorkspaceHandler, { method: 'POST', body }, ip);
  return { result, data: (result.json as { data: CreatedDemo }).data };
}

/** Session token of the signed better-auth cookie (`token.signature`). */
function sessionTokenFrom(setCookie: unknown): string {
  const match = /better-auth\.session_token=([^;]+)/.exec(String(setCookie));
  if (!match) throw new Error('no session cookie');
  return decodeURIComponent(match[1]!).split('.')[0]!;
}

async function contentLocalesOf(workspaceId: string) {
  const row = await prisma.workspaceSetting.findUnique({ where: { workspaceId_setting: { workspaceId, setting: 'contentLocales' } } });
  return parseContentLocales(row?.value);
}

const env = { ...process.env };

beforeAll(() => {
  process.env.DEMO_MODE = 'true';
  process.env.DEMO_CLEANUP_SECRET = CLEANUP_SECRET;
  delete process.env.DEMO_TTL_HOURS;
});

afterAll(() => {
  for (const key of ['DEMO_MODE', 'DEMO_CLEANUP_SECRET', 'DEMO_TTL_HOURS']) {
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }
});

describe('demo login token', () => {
  it('is bound to the user and expires', () => {
    const now = Date.now();
    const token = createDemoLoginToken('user-1', now);
    expect(verifyDemoLoginToken(token, now)).toBe('user-1');
    expect(verifyDemoLoginToken(token, now + DEMO_LOGIN_TOKEN_TTL_MS + 1)).toBeNull();
    const [, expiresAt, signature] = token.split('.');
    expect(verifyDemoLoginToken(`user-2.${expiresAt}.${signature}`, now)).toBeNull();
    expect(verifyDemoLoginToken(`user-1.${Number(expiresAt) + 1}.${signature}`, now)).toBeNull();
    expect(verifyDemoLoginToken('garbage', now)).toBeNull();
  });
});

describe('demo config endpoint', () => {
  it('reports the runtime demo flag and TTL', async () => {
    const enabled = await invoke(demoConfigHandler, { method: 'GET' });
    expect(enabled.status).toBe(200);
    expect(enabled.json).toEqual({ data: { enabled: true, ttlHours: 24 } });

    process.env.DEMO_MODE = 'false';
    try {
      expect((await invoke(demoConfigHandler, { method: 'GET' })).json).toEqual({ data: { enabled: false, ttlHours: null } });
    } finally {
      process.env.DEMO_MODE = 'true';
    }
    expect((await invoke(demoConfigHandler, { method: 'POST' })).status).toBe(405);
  });
});

describe('demo create-workspace + demo-login', () => {
  it('clones the DEMO template in the visitor language with sample activity and logs in once with the token', async () => {
    // The DEMO template from the database (synced from templates/demo).
    await ensureBuiltInTemplates({ force: true });
    expect(await prisma.workspaceTemplate.findFirst({ where: { kind: 'DEMO', isDefault: true } })).toMatchObject({ key: 'demo', published: true });

    const before = Date.now();
    const { result, data } = await createDemo(undefined, { locale: 'en-GB' });
    expect(result.status).toBe(200);
    expect(data.loginToken).toBeTruthy();
    expect(data.mode).toBe('full');
    const workspaceId = data.workspaceId;

    const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, include: { users: true } });
    expect(workspace).toMatchObject({ isDemo: true, demoUserId: data.userId, name: 'Demo bar' });
    expect(workspace.description).toContain('24 hours');
    expect(workspace.setupCompletedAt).not.toBeNull();
    expect(workspace.expiresAt!.getTime()).toBeGreaterThanOrEqual(before + 24 * 3600_000 - 1000);
    expect(workspace.users).toEqual([expect.objectContaining({ userId: data.userId, role: 'OWNER' })]);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: data.userId }, include: { settings: true } });
    expect(user).toMatchObject({ name: 'Demo user', email: null });
    expect(user.settings).toEqual(expect.arrayContaining([expect.objectContaining({ setting: 'language', value: 'en' })]));

    // Content in English, German kept as translation.
    expect(await contentLocalesOf(workspaceId)).toEqual({ primary: 'en', additional: ['de'] });
    const glass = await prisma.glass.findFirstOrThrow({ where: { workspaceId, name: 'Highball glass' }, include: { translations: true } });
    expect(glass.translations).toEqual([expect.objectContaining({ locale: 'de', name: 'Highball-Glas' })]);
    expect(await prisma.ingredient.count({ where: { workspaceId, name: 'Lime juice' } })).toBe(1);
    expect(await prisma.cocktailRecipe.count({ where: { workspaceId } })).toBe(12);
    expect(await prisma.cocktailRecipeIngredient.count({ where: { cocktailRecipeStep: { cocktailRecipe: { workspaceId } } } })).toBeGreaterThan(30);
    expect(await prisma.ingredient.count({ where: { workspaceId, guestInfoComplete: false } })).toBe(0);
    expect(await prisma.cocktailRecipe.count({ where: { workspaceId, price: null } })).toBe(0);
    expect(await prisma.tagDefinition.count({ where: { workspaceId } })).toBeGreaterThan(10);
    const images = await prisma.cocktailRecipeImage.findMany({ where: { cocktailRecipe: { workspaceId } } });
    expect(images).toHaveLength(6);
    expect(images.every((image) => image.image.startsWith('data:image/jpeg;base64,'))).toBe(true);
    expect(await prisma.unitConversion.count({ where: { workspaceId, autoGenerated: true } })).toBeGreaterThan(0);
    const settings = await prisma.workspaceSetting.findMany({ where: { workspaceId } });
    expect(settings).toEqual(expect.arrayContaining([expect.objectContaining({ setting: 'timezone', value: 'Europe/Berlin' })]));

    const cards = await prisma.cocktailCard.findMany({ where: { workspaceId }, include: { groups: { include: { items: true } } }, orderBy: { name: 'asc' } });
    expect(cards.map((card) => card.name)).toEqual(['Classics', 'Summer Specials']);
    expect(cards.every((card) => card.groups.length >= 2 && card.groups.every((group) => group.items.length > 0))).toBe(true);
    const calculations = await prisma.cocktailCalculation.findMany({ where: { workspaceId }, include: { cocktailCalculationItems: true } });
    expect(calculations).toHaveLength(1);
    expect(calculations[0]!.cocktailCalculationItems.length).toBe(5);

    // The guest menu stays enabled, default and published, and is publicly reachable at /m/{workspaceId}.
    const menus = await prisma.guestMenu.findMany({ where: { workspaceId } });
    expect(menus).toHaveLength(1);
    expect(menus[0]).toMatchObject({ enabled: true, isDefault: true, accessCodeHash: null, sourceCardId: cards[0]!.id });
    expect(menus[0]!.published).not.toBeNull();
    const publicMenu = await loadPublicMenu({ bar: workspaceId, locale: 'en' });
    expect(publicMenu.kind).toBe('menu');
    if (publicMenu.kind === 'menu') expect(publicMenu.menu).not.toBeNull();
    const slides = await prisma.signageSlide.findMany({ where: { workspaceId } });
    expect(slides).toEqual([expect.objectContaining({ type: 'GUEST_MENU', guestMenuId: menus[0]!.id, enabled: true })]);

    // Sample activity: statistics of the last 14 days on the demo user, ratings and a queue.
    const statistics = await prisma.cocktailStatisticItem.findMany({ where: { workspaceId } });
    expect(statistics.length).toBeGreaterThan(50);
    const now = Date.now();
    expect(statistics.every((item) => item.date.getTime() <= now && item.date.getTime() > now - 15 * 24 * 3600_000)).toBe(true);
    expect(statistics.every((item) => item.userId === data.userId)).toBe(true);
    expect(statistics.some((item) => item.cocktailCardId === cards[0]!.id && item.actionSource === 'CARD')).toBe(true);
    expect(await prisma.cocktailRating.count({ where: { cocktail: { workspaceId } } })).toBeGreaterThanOrEqual(2);
    expect(await prisma.cocktailQueue.count({ where: { workspaceId } })).toBe(2);

    const login = await invoke(demoLoginHandler, { method: 'POST', body: { userId: data.userId, loginToken: data.loginToken } });
    expect(login.status).toBe(200);
    const setCookie = String(login.headers['Set-Cookie']);
    const token = sessionTokenFrom(setCookie);
    const session = await prisma.session.findFirstOrThrow({ where: { token } });
    expect(session.userId).toBe(data.userId);
    expect(session.expiresAt.getTime()).toBeLessThanOrEqual(new Date(data.expiresAt).getTime());
    // better-auth itself accepts the signed cookie (client session via /api/auth/get-session), a forged one not.
    const cookie = setCookie.split(';')[0]!;
    const authSession = await auth.api.getSession({ headers: new Headers({ cookie }) });
    expect(authSession?.user.id).toBe(data.userId);
    expect(await auth.api.getSession({ headers: new Headers({ cookie: `better-auth.session_token=${token}.forged` }) })).toBeNull();

    // The session works for the demo workspace; no guide progress yet, so the basics tour is offered.
    const me = await invoke(workspaceItemHandler, { method: 'GET', query: { workspaceId }, headers: sessionCookie(token) });
    expect(me.status).toBe(200);
    expect(await prisma.userGuideProgress.count({ where: { userId: data.userId } })).toBe(0);

    // Single use.
    const again = await invoke(demoLoginHandler, { method: 'POST', body: { loginToken: data.loginToken } });
    expect(again.status).toBe(401);
    expect(await prisma.session.count({ where: { userId: data.userId } })).toBe(1);
  });

  it('defaults to German and falls back to the repo template when the database has none', async () => {
    expect(await prisma.workspaceTemplate.count({ where: { kind: 'DEMO' } })).toBe(0);
    const { result, data } = await createDemo();
    expect(result.status).toBe(200);
    const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: data.workspaceId } });
    expect(workspace.name).toBe('Demo-Bar');
    expect((await prisma.user.findUniqueOrThrow({ where: { id: data.userId } })).name).toBe('Demo-Nutzer');
    expect(await contentLocalesOf(data.workspaceId)).toEqual({ primary: 'de', additional: ['en'] });
    expect(await prisma.glass.count({ where: { workspaceId: data.workspaceId, name: 'Highball-Glas' } })).toBe(1);
    expect(await prisma.cocktailRecipe.count({ where: { workspaceId: data.workspaceId } })).toBe(12);
    const menu = await prisma.guestMenu.findFirstOrThrow({ where: { workspaceId: data.workspaceId } });
    expect(menu.enabled).toBe(true);
    expect(menu.published).not.toBeNull();
    // Unsupported languages fall back to German.
    const french = await createDemo(undefined, { locale: 'fr' });
    expect((await prisma.workspace.findUniqueOrThrow({ where: { id: french.data.workspaceId } })).name).toBe('Demo-Bar');
  });

  it('uses a custom default DEMO template from the database', async () => {
    await ensureBuiltInTemplates({ force: true });
    const curated = await seedWorkspace({ users: [{ role: 'OWNER' }] });
    await prisma.glass.create({ data: { name: 'Curated glass', deposit: 0, workspaceId: curated.workspace.id } });
    await markWorkspaceAsTemplate({
      workspaceId: curated.workspace.id,
      key: 'curated-demo',
      kind: 'DEMO',
      name: { de: 'Kuratiert' },
      locales: ['de'],
      published: true,
      isDefault: true,
    });

    const { result, data } = await createDemo();
    expect(result.status).toBe(200);
    expect(await prisma.glass.findMany({ where: { workspaceId: data.workspaceId }, select: { name: true } })).toEqual([{ name: 'Curated glass' }]);
    expect(await prisma.cocktailRecipe.count({ where: { workspaceId: data.workspaceId } })).toBe(0);
  });

  it('setup mode creates an empty workspace that starts in the setup assistant', async () => {
    const { result, data } = await createDemo(undefined, { locale: 'en', mode: 'setup' });
    expect(result.status).toBe(200);
    expect(data.mode).toBe('setup');
    const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: data.workspaceId } });
    expect(workspace).toMatchObject({ isDemo: true, setupCompletedAt: null, name: 'Demo bar' });
    expect(await contentLocalesOf(data.workspaceId)).toEqual({ primary: 'en', additional: [] });
    // BASE only: units and ice, but no content and no activity.
    expect(await prisma.unit.count({ where: { workspaceId: data.workspaceId } })).toBeGreaterThan(0);
    expect(await prisma.ice.count({ where: { workspaceId: data.workspaceId } })).toBeGreaterThan(0);
    expect(await prisma.cocktailRecipe.count({ where: { workspaceId: data.workspaceId } })).toBe(0);
    expect(await prisma.guestMenu.count({ where: { workspaceId: data.workspaceId } })).toBe(0);
    expect(await prisma.cocktailStatisticItem.count({ where: { workspaceId: data.workspaceId } })).toBe(0);
    expect((await invoke(demoLoginHandler, { method: 'POST', body: { loginToken: data.loginToken } })).status).toBe(200);
  });

  it('rejects invalid bodies', async () => {
    const invalid = await invoke(createWorkspaceHandler, { method: 'POST', body: { mode: 'everything' } });
    expect(invalid.status).toBe(400);
    expect(errorCodeOf(invalid)).toBe('VALIDATION_ERROR');
    expect(await prisma.workspace.count({ where: { isDemo: true } })).toBe(0);
  });

  it('rejects the old userId-only login, forged tokens and tokens of non-demo users', async () => {
    const { data } = await createDemo();
    expect((await invoke(demoLoginHandler, { method: 'POST', body: { userId: data.userId } })).status).toBe(400);

    const [, expiresAt] = data.loginToken.split('.');
    const forged = `${data.userId}.${expiresAt}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;
    expect((await invoke(demoLoginHandler, { method: 'POST', body: { loginToken: forged } })).status).toBe(401);
    expect((await invoke(demoLoginHandler, { method: 'POST', body: { userId: 'someone-else', loginToken: data.loginToken } })).status).toBe(401);

    // A validly signed token for a regular user (has an e-mail, no demo workspace) is useless.
    const regular = await seedWorkspace({ users: [{ role: 'OWNER' }] });
    const regularUserId = regular.users[0]!.user.id;
    const sessionsBefore = await prisma.session.count({ where: { userId: regularUserId } });
    const login = await invoke(demoLoginHandler, { method: 'POST', body: { loginToken: createDemoLoginToken(regularUserId) } });
    expect(login.status).toBe(401);
    expect(await prisma.session.count({ where: { userId: regularUserId } })).toBe(sessionsBefore);
    expect(await prisma.session.count({ where: { userId: data.userId } })).toBe(0);
  });

  it('concurrent logins with the same token create exactly one session', async () => {
    const { data } = await createDemo(undefined, { mode: 'setup' });
    const results = await Promise.all(Array.from({ length: 10 }, () => invoke(demoLoginHandler, { method: 'POST', body: { loginToken: data.loginToken } })));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 401)).toHaveLength(9);
    expect(await prisma.session.count({ where: { userId: data.userId } })).toBe(1);
  });

  it('refuses logins into expired demo workspaces', async () => {
    const { data } = await createDemo(undefined, { mode: 'setup' });
    await prisma.workspace.update({ where: { id: data.workspaceId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await invoke(demoLoginHandler, { method: 'POST', body: { loginToken: data.loginToken } })).status).toBe(401);
  });

  it('rate-limits workspace creation per client IP', async () => {
    const ip = '203.0.113.7';
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await createDemo(ip, { mode: i % 2 === 0 ? 'setup' : 'full' })).result.status);
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
    expect(await prisma.workspace.count({ where: { isDemo: true } })).toBe(5);
    expect((await createDemo('203.0.113.8', { mode: 'setup' })).result.status).toBe(200);
  });

  it('is disabled outside demo mode and answers wrong methods with 405', async () => {
    expect((await invoke(createWorkspaceHandler, { method: 'GET' })).status).toBe(405);
    expect((await invoke(demoLoginHandler, { method: 'GET' })).status).toBe(405);
    process.env.DEMO_MODE = 'false';
    try {
      expect((await invoke(createWorkspaceHandler, { method: 'POST' })).status).toBe(403);
      expect((await invoke(demoLoginHandler, { method: 'POST', body: { loginToken: 'x' } })).status).toBe(404);
      expect((await invoke(cleanupHandler, { method: 'POST', headers: bearerToken(CLEANUP_SECRET) })).status).toBe(403);
    } finally {
      process.env.DEMO_MODE = 'true';
    }
    expect(await prisma.workspace.count()).toBe(0);
  });
});

describe('demo cleanup', () => {
  async function seedCleanupScenario() {
    const expired = await createDemo();
    const live = await createDemo(undefined, { mode: 'setup' });
    await prisma.workspace.update({ where: { id: expired.data.workspaceId }, data: { expiresAt: new Date(Date.now() - 60_000) } });
    // Orphan left behind by the old GET path (workspace deleted, user kept).
    const orphan = await prisma.user.create({ data: { name: 'Orphan demo user' } });
    // Regular account without any workspace must survive.
    const regular = await prisma.user.create({ data: { name: 'Regular', email: 'regular@test.local' } });
    return { expired: expired.data, live: live.data, orphan, regular };
  }

  it('requires the cleanup secret or the master key', async () => {
    const { expired } = await seedCleanupScenario();
    expect((await invoke(cleanupHandler, { method: 'POST' })).status).toBe(401);
    const wrong = await invoke(cleanupHandler, { method: 'POST', headers: bearerToken('wrong-secret') });
    expect(wrong.status).toBe(401);
    expect(errorCodeOf(wrong)).toBe('UNAUTHORIZED');
    expect(await prisma.workspace.count({ where: { id: expired.workspaceId } })).toBe(1);
    expect((await invoke(cleanupHandler, { method: 'GET', headers: bearerToken(CLEANUP_SECRET) })).status).toBe(405);
  });

  it('deletes expired demo workspaces with their content and users and sweeps orphaned demo users', async () => {
    const { expired, live, orphan, regular } = await seedCleanupScenario();
    const result = await invoke(cleanupHandler, { method: 'POST', headers: bearerToken(CLEANUP_SECRET) });
    expect(result.status).toBe(200);
    expect((result.json as { data: { deletedCount: number; deletedUsers: number } }).data).toMatchObject({ deletedCount: 1, deletedUsers: 1 });

    expect(await prisma.workspace.count({ where: { id: expired.workspaceId } })).toBe(0);
    expect(await prisma.user.count({ where: { id: expired.userId } })).toBe(0);
    expect(await prisma.cocktailRecipe.count({ where: { workspaceId: expired.workspaceId } })).toBe(0);
    expect(await prisma.cocktailStatisticItem.count({ where: { workspaceId: expired.workspaceId } })).toBe(0);
    expect(await prisma.guestMenu.count({ where: { workspaceId: expired.workspaceId } })).toBe(0);
    expect(await prisma.user.count({ where: { id: orphan.id } })).toBe(0);
    expect(await prisma.workspace.count({ where: { id: live.workspaceId } })).toBe(1);
    expect(await prisma.user.count({ where: { id: live.userId } })).toBe(1);
    expect(await prisma.user.count({ where: { id: regular.id } })).toBe(1);

    expect((await invoke(cleanupHandler, { method: 'POST', headers: asMasterKey() })).status).toBe(200);
  });

  it('deleteDemoWorkspace removes the workspace and its demo user atomically, but never regular workspaces', async () => {
    const { data } = await createDemo();
    expect(await deleteDemoWorkspace(data.workspaceId)).toBe(true);
    expect(await prisma.user.count({ where: { id: data.userId } })).toBe(0);

    const regular = await seedWorkspace({ users: [{ role: 'OWNER' }] });
    expect(await deleteDemoWorkspace(regular.workspace.id)).toBe(false);
    expect(await prisma.workspace.count({ where: { id: regular.workspace.id } })).toBe(1);
  });
});
