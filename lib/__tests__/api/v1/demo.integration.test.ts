import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import createWorkspaceHandler from '../../../../pages/api/demo/create-workspace';
import demoLoginHandler from '../../../../pages/api/auth/demo-login';
import cleanupHandler from '../../../../pages/api/demo/cleanup';
import { itemHandler as workspaceItemHandler } from '@lib/api/v1/workspace';
import { createDemoLoginToken, DEMO_LOGIN_TOKEN_TTL_MS, verifyDemoLoginToken } from '@lib/demo/loginToken';
import { deleteDemoWorkspace } from '@lib/demo/cleanup';
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
}

async function createDemo(ip?: string) {
  const result = await invoke(createWorkspaceHandler, { method: 'POST' }, ip);
  return { result, data: (result.json as { data: CreatedDemo }).data };
}

function sessionTokenFrom(setCookie: unknown): string {
  const match = /better-auth\.session_token=([^;]+)/.exec(String(setCookie));
  if (!match) throw new Error('no session cookie');
  return match[1]!;
}

const env = { ...process.env };

beforeAll(() => {
  const dir = mkdtempSync(join(tmpdir(), 'demo-config-'));
  const configPath = join(dir, 'demo.json');
  writeFileSync(
    configPath,
    JSON.stringify({
      workspace: { name: 'Demo Test', description: 'Demo' },
      glasses: [
        { name: 'Tumbler', deposit: 0, image: resolve('config/images/glasses/martini.png') },
        { name: 'Svg Glass', deposit: 0, image: './evil.svg' },
      ],
      ingredients: [{ name: 'Gin', unitName: 'CL', volume: 70 }],
      garnishes: [{ name: 'Lime' }],
      cocktails: [
        {
          name: 'Gin Tonic',
          iceName: 'ICE_CUBES',
          glassName: 'Tumbler',
          garnishes: [{ garnishName: 'Lime', garnishNumber: 1 }],
          steps: [
            {
              stepNumber: 1,
              actionName: 'BUILD_IN_GLASS',
              actionGroup: 'MIXING',
              ingredients: [{ ingredientNumber: 1, ingredientName: 'Gin', amount: 4, unitName: 'CL' }],
            },
          ],
        },
      ],
    }),
  );
  process.env.DEMO_MODE = 'true';
  process.env.DEMO_WORKSPACE_CONFIG_PATH = configPath;
  process.env.DEMO_CLEANUP_SECRET = CLEANUP_SECRET;
});

afterAll(() => {
  for (const key of ['DEMO_MODE', 'DEMO_WORKSPACE_CONFIG_PATH', 'DEMO_CLEANUP_SECRET']) {
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

describe('demo create-workspace + demo-login', () => {
  it('creates the seeded demo workspace in one go and logs in once with the token', async () => {
    const { result, data } = await createDemo();
    expect(result.status).toBe(200);
    expect(data.loginToken).toBeTruthy();

    const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: data.workspaceId }, include: { users: true } });
    expect(workspace).toMatchObject({ isDemo: true, demoUserId: data.userId });
    expect(workspace.users).toEqual([expect.objectContaining({ userId: data.userId, role: 'OWNER' })]);
    expect(await prisma.cocktailRecipe.count({ where: { workspaceId: data.workspaceId } })).toBe(1);
    expect(await prisma.cocktailRecipeIngredient.count({ where: { cocktailRecipeStep: { cocktailRecipe: { workspaceId: data.workspaceId } } } })).toBe(1);
    // Only raster images are seeded (the .svg entry is ignored).
    const images = await prisma.glassImage.findMany({ where: { glass: { workspaceId: data.workspaceId } } });
    expect(images.map((image) => image.image.slice(0, 22))).toEqual(['data:image/png;base64,']);
    expect(await prisma.unitConversion.count({ where: { workspaceId: data.workspaceId, autoGenerated: true } })).toBeGreaterThan(0);

    const login = await invoke(demoLoginHandler, { method: 'POST', body: { userId: data.userId, loginToken: data.loginToken } });
    expect(login.status).toBe(200);
    const token = sessionTokenFrom(login.headers['Set-Cookie']);
    const session = await prisma.session.findFirstOrThrow({ where: { token } });
    expect(session.userId).toBe(data.userId);
    expect(session.expiresAt.getTime()).toBeLessThanOrEqual(new Date(data.expiresAt).getTime());

    // The session works for the demo workspace.
    const me = await invoke(workspaceItemHandler, { method: 'GET', query: { workspaceId: data.workspaceId }, headers: sessionCookie(token) });
    expect(me.status).toBe(200);

    // Single use.
    const again = await invoke(demoLoginHandler, { method: 'POST', body: { loginToken: data.loginToken } });
    expect(again.status).toBe(401);
    expect(await prisma.session.count({ where: { userId: data.userId } })).toBe(1);
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
    const { data } = await createDemo();
    const results = await Promise.all(Array.from({ length: 10 }, () => invoke(demoLoginHandler, { method: 'POST', body: { loginToken: data.loginToken } })));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 401)).toHaveLength(9);
    expect(await prisma.session.count({ where: { userId: data.userId } })).toBe(1);
  });

  it('refuses logins into expired demo workspaces', async () => {
    const { data } = await createDemo();
    await prisma.workspace.update({ where: { id: data.workspaceId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await invoke(demoLoginHandler, { method: 'POST', body: { loginToken: data.loginToken } })).status).toBe(401);
  });

  it('rate-limits workspace creation per client IP', async () => {
    const ip = '203.0.113.7';
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await createDemo(ip)).result.status);
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
    expect(await prisma.workspace.count({ where: { isDemo: true } })).toBe(5);
    expect((await createDemo('203.0.113.8')).result.status).toBe(200);
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
    const live = await createDemo();
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

  it('deletes expired demo workspaces with their users and sweeps orphaned demo users', async () => {
    const { expired, live, orphan, regular } = await seedCleanupScenario();
    const result = await invoke(cleanupHandler, { method: 'POST', headers: bearerToken(CLEANUP_SECRET) });
    expect(result.status).toBe(200);
    expect((result.json as { data: { deletedCount: number; deletedUsers: number } }).data).toMatchObject({ deletedCount: 1, deletedUsers: 1 });

    expect(await prisma.workspace.count({ where: { id: expired.workspaceId } })).toBe(0);
    expect(await prisma.user.count({ where: { id: expired.userId } })).toBe(0);
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
