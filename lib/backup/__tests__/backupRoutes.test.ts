import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';
import { Prisma, Role } from '@generated/prisma/client';
import { createDefaultGuestMenuDocument } from '@lib/guest-menu/schema';

/** Prisma model mock: findMany → [], findFirst/findUnique → null, count → 0, create → row with id. */
function createModelMock() {
  const methods = new Map<string, ReturnType<typeof vi.fn>>();
  return new Proxy({} as Record<string, ReturnType<typeof vi.fn>>, {
    get(_target, method: string) {
      if (!methods.has(method)) {
        methods.set(
          method,
          vi.fn(async (args?: { data?: Record<string, unknown> }) => {
            if (method === 'findMany') return [];
            if (method === 'findFirst' || method === 'findUnique') return null;
            if (method === 'count') return 0;
            if (method === 'create' || method === 'upsert') return { id: `new-${Math.random().toString(36).slice(2)}`, ...(args?.data ?? {}) };
            return { count: 0 };
          }),
        );
      }
      return methods.get(method);
    },
  });
}

function createClientMock() {
  const models = new Map<string, ReturnType<typeof createModelMock>>();
  // Advisory locks (lockWorkspaceScope) use $executeRaw.
  return new Proxy({ $executeRaw: vi.fn(async () => 0) } as unknown as Record<string, ReturnType<typeof createModelMock>>, {
    get(target, model: string) {
      if (model in target) return target[model];
      if (!models.has(model)) models.set(model, createModelMock());
      return models.get(model);
    },
  });
}

const mocks = vi.hoisted(() => ({ prisma: null as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>> }));

vi.mock('../../../prisma/prisma', () => ({
  get default() {
    return mocks.prisma;
  },
  asWorkspace: <T>(row: T) => row,
}));
vi.mock('@lib/auth', () => ({ auth: { api: { getSession: vi.fn().mockResolvedValue(null) } } }));
vi.mock('../../../middleware/api/jwtApiKeyMiddleware', () => ({
  authenticateApiKey: vi.fn().mockResolvedValue(null),
  checkMasterApiKey: vi.fn().mockReturnValue(false),
}));

import exportHandler from '@lib/backup/exportHandler';
import importHandler from '@lib/backup/importHandler';
import { auth } from '@lib/auth';
import { authenticateApiKey } from '../../../middleware/api/jwtApiKeyMiddleware';

function createRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: unknown) {
      this.body = data;
      return this;
    },
  };
  return res as unknown as NextApiResponse & { statusCode: number; body: unknown };
}

const workspace = { id: 'ws-1', name: 'Bar', users: [] };

function request(method: string, body?: unknown) {
  return {
    method,
    query: { workspaceId: 'ws-1' },
    headers: { authorization: 'Bearer key' },
    body: body === undefined ? undefined : JSON.stringify(body),
  } as unknown as NextApiRequest;
}

function useApiKey(permissions: string[]) {
  vi.mocked(authenticateApiKey).mockResolvedValue({
    apiKey: { id: 'k1', keyId: 'key1', name: 'Key', createdByUserId: 'user-1', workspaceId: 'ws-1' } as never,
    workspace: workspace as never,
    permissions: permissions as never,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma = createClientMock() as never;
  // The export reads inside a (RepeatableRead) transaction: hand it the root mock so per-test stubs apply.
  mocks.prisma.$transaction = vi.fn(async (fn: (client: unknown) => Promise<unknown>) => fn(mocks.prisma)) as never;
  vi.mocked(authenticateApiKey).mockResolvedValue(null);
  vi.mocked(auth.api.getSession).mockResolvedValue(null);
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
});

describe.each([
  ['export', exportHandler, 'GET', 'BACKUPS_EXPORT'],
  ['import', importHandler, 'POST', 'BACKUPS_IMPORT'],
] as const)('backup %s permissions', (_name, handler, method, permission) => {
  it('requires the backup permission for API keys', async () => {
    useApiKey(['COCKTAILS_READ', 'WORKSPACE_READ', 'WORKSPACE_UPDATE', 'GUEST_MENUS_READ']);
    const res = createRes();
    await handler(request(method, {}), res);
    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({ message: 'API key does not have required permission' });
  });

  it('accepts API keys with the backup permission', async () => {
    useApiKey([permission]);
    const res = createRes();
    await handler(request(method, {}), res);
    expect(res.statusCode).toBe(200);
  });

  it('only accepts ADMIN/OWNER sessions', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: 'user-1' }, session: {} } as never);
    mocks.prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    mocks.prisma.workspace.findFirst.mockResolvedValue(null);
    const res = createRes();
    await handler(request(method, {}), res);
    expect(res.statusCode).toBe(403);
    const roles = mocks.prisma.workspace.findFirst.mock.calls[0][0].where.users.some.role.in as Role[];
    expect([...roles].sort()).toEqual([Role.ADMIN, Role.OWNER].sort());
  });
});

describe('backup export', () => {
  it('strips guest menu secrets', async () => {
    useApiKey(['BACKUPS_EXPORT']);
    mocks.prisma.guestMenu.findMany.mockResolvedValue([
      { id: 'm1', name: 'Abend', slug: 'abend', accessCodeHash: '$2b$10$hash', accessCodeVersion: 2, previewToken: 'preview-secret', draft: {} },
    ]);
    const res = createRes();
    await exportHandler(request('GET'), res);
    const body = res.body as { guestMenus: Record<string, unknown>[] };
    expect(body.guestMenus).toEqual([{ id: 'm1', name: 'Abend', slug: 'abend', draft: {} }]);
    expect(JSON.stringify(body)).not.toMatch(/accessCode|previewToken|preview-secret|signageKey/);
    // The workspace row (signage key), API keys and join codes are never read for the export.
    expect(mocks.prisma.workspaceApiKey.findMany).not.toHaveBeenCalled();
    expect(mocks.prisma.workspaceJoinCode.findMany).not.toHaveBeenCalled();
    expect(mocks.prisma.workspace.findMany).not.toHaveBeenCalled();
  });
});

describe('backup import', () => {
  function setupTransaction() {
    const tx = createClientMock();
    mocks.prisma.$transaction = vi.fn(async (fn: (client: unknown) => Promise<unknown>) => fn(tx));
    return tx as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
  }

  it('creates guest menus disabled/unpublished, skips invalid items and remaps signage slides', async () => {
    useApiKey(['BACKUPS_IMPORT']);
    const tx = setupTransaction();
    const validDoc = createDefaultGuestMenuDocument({ withCardSection: false });
    const backup = {
      workspaceSettings: [
        { setting: 'timezone', value: 'Europe/Berlin' },
        { setting: 'timezone', value: 'Not/AZone' },
        { setting: 'currency', value: 'EURO' },
      ],
      guestMenuTemplates: [
        { id: 't-ok', name: 'Ok', definition: { schemaVersion: 1, baseTemplateId: 'classic', slots: {} } },
        { id: 't-bad', name: 'Broken', definition: { schemaVersion: 1, baseTemplateId: 'classic', slots: { item: '{% if %}' } } },
      ],
      guestMenus: [
        {
          id: 'm-ok',
          name: 'Live',
          slug: 'live',
          enabled: true,
          isDefault: true,
          published: validDoc,
          publishedAt: '2026-01-01T00:00:00.000Z',
          accessCodeHash: 'attacker-hash',
          accessCodeVersion: 7,
          previewToken: 'known-token',
          draft: validDoc,
        },
        { id: 'm-bad', name: 'Kaputt', slug: 'kaputt', draft: { blocks: 'nope' } },
      ],
      signageSlides: [{ id: 's1', format: 'PORTRAIT', type: 'GUEST_MENU', guestMenuId: 'm-ok', content: '', order: 0 }],
    };
    const res = createRes();
    await importHandler(request('POST', backup), res);

    expect(res.statusCode).toBe(200);
    const report = (res.body as { report: { skipped: { type: string; name: string }[] } }).report;
    expect(report.skipped.map(({ type, name }) => `${type}:${name}`)).toEqual([
      'workspaceSetting:timezone',
      'workspaceSetting:currency',
      'guestMenuTemplate:Broken',
      'guestMenu:Kaputt',
    ]);

    expect(tx.workspaceSetting.upsert).toHaveBeenCalledTimes(1);
    expect(tx.guestMenuTemplate.create).toHaveBeenCalledTimes(1);
    expect(tx.guestMenu.create).toHaveBeenCalledTimes(1);
    const data = tx.guestMenu.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ enabled: false, isDefault: false, publishedAt: null, accessCodeHash: null, accessCodeVersion: 0, slug: 'live' });
    expect(data.published).toBe(Prisma.DbNull);
    expect(data.previewToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(data.previewToken).not.toBe('known-token');

    const createdMenuId = (await tx.guestMenu.create.mock.results[0].value).id;
    const createdSlideId = (await tx.signageSlide.create.mock.results[0].value).id;
    expect(tx.signageSlide.update).toHaveBeenCalledWith({ where: { id: createdSlideId }, data: { guestMenuId: createdMenuId } });
  });
});
