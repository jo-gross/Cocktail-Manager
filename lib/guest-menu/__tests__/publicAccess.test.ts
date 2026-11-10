/** Access checks of `loadPublicMenu` for menus with an access code. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GuestMenu } from '@generated/prisma/client';
import { createDefaultGuestMenuDocument } from '../schema';
import type { RenderGuestMenuInput } from '../server';

const state = vi.hoisted(() => ({ menus: [] as unknown[], renders: [] as unknown[] }));

vi.mock('../../../prisma/prisma', () => ({
  default: { guestMenu: { findMany: vi.fn(async () => state.menus) } },
}));

vi.mock('../resolve', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../resolve')>();
  return {
    ...actual,
    loadWorkspaceGuestSettings: vi.fn(async () => ({
      timezone: 'UTC',
      currency: 'EUR',
      contentLocales: { primary: 'de', additional: [] },
      dayStartTime: null,
    })),
  };
});

vi.mock('../server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../server')>();
  return {
    ...actual,
    findPublicWorkspace: vi.fn(async () => ({ id: 'ws1', name: 'Bar', publicSlug: 'bar', hasImage: true })),
    renderGuestMenu: vi.fn(async (input: RenderGuestMenuInput) => {
      state.renders.push(input);
      return { dto: { menu: { id: input.menu.id } }, rendered: {}, meta: { cocktailImageIds: [], cocktailIds: [], menuAssets: [], workspaceLogo: false } };
    }),
  };
});

const { loadPublicMenu } = await import('../public.server');
const { createGuestAccessToken, createMenuAccess, createSignageAccessToken, verifyAccessToken } = await import('../access');

const NOW = new Date('2026-11-10T12:00:00Z');
const document = createDefaultGuestMenuDocument({ title: 'Eventkarte' });

function menu(overrides: Partial<GuestMenu> & { id: string; slug: string }): GuestMenu {
  return {
    workspaceId: 'ws1',
    name: overrides.slug,
    enabled: true,
    isDefault: false,
    priority: 0,
    validFrom: null,
    validTo: null,
    weekdays: [],
    timeFrom: null,
    timeTo: null,
    inactiveBehavior: 'NOTICE_WITH_CONTENT',
    sourceMode: 'NONE',
    sourceCardId: null,
    locales: [],
    draft: document,
    published: document,
    publishedAt: NOW,
    previewToken: `preview-${overrides.id}`,
    accessCodeHash: null,
    accessCodeVersion: 0,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  } as GuestMenu;
}

const secret = menu({ id: 'm1', slug: 'event', accessCodeHash: 'n:$2b$10$x', accessCodeVersion: 2 });
const open = menu({ id: 'm2', slug: 'abend', priority: 5 });

let previousSecret: string | undefined;
beforeEach(() => {
  previousSecret = process.env.BETTER_AUTH_SECRET;
  process.env.BETTER_AUTH_SECRET = 'test-secret';
  state.menus = [secret, open];
  state.renders = [];
});
afterEach(() => {
  process.env.BETTER_AUTH_SECRET = previousSecret;
});

const guestAccess = (target: GuestMenu) => createMenuAccess([verifyAccessToken(createGuestAccessToken(target, NOW.getTime()).token, NOW.getTime())!]);

describe('loadPublicMenu – access code', () => {
  it('locks the active protected menu without rendering it (only title/logo/theme)', async () => {
    const result = await loadPublicMenu({ bar: 'bar', now: NOW });
    expect(result.kind).toBe('locked');
    if (result.kind !== 'locked') return;
    expect(result.lock).toMatchObject({ menuId: 'm1', title: 'Eventkarte', numeric: true, unlockPath: '/api/public/menus/bar/event/unlock' });
    expect(result.lock.logoUrl).toBe('/api/public/images/bar/workspace-logo/ws1');
    expect(JSON.stringify(result)).not.toContain('$2b$');
    expect(state.renders).toHaveLength(0);
  });

  it('locks a directly addressed protected menu, also when inactive (no notice/content leak)', async () => {
    state.menus = [{ ...secret, weekdays: [(NOW.getUTCDay() + 1) % 7] }, open];
    const result = await loadPublicMenu({ bar: 'bar', menuSlug: 'event', now: NOW });
    expect(result.kind).toBe('locked');
    expect(state.renders).toHaveLength(0);
  });

  it('renders with a valid guest cookie', async () => {
    const result = await loadPublicMenu({ bar: 'bar', menuSlug: 'event', now: NOW, access: guestAccess(secret) });
    expect(result.kind).toBe('menu');
    if (result.kind === 'menu') expect(result.isProtected).toBe(true);
    expect((state.renders[0] as RenderGuestMenuInput).accessToken).toBeNull();
  });

  it('rejects tokens of an older code version', async () => {
    state.menus = [{ ...secret, accessCodeVersion: 3 }, open];
    const result = await loadPublicMenu({ bar: 'bar', menuSlug: 'event', now: NOW, access: guestAccess(secret) });
    expect(result.kind).toBe('locked');
  });

  it('a token of another menu does not unlock', async () => {
    const result = await loadPublicMenu({ bar: 'bar', menuSlug: 'event', now: NOW, access: guestAccess(open) });
    expect(result.kind).toBe('locked');
  });

  it('signage tokens unlock and are passed on for image URLs', async () => {
    const token = createSignageAccessToken(secret, NOW.getTime());
    const access = createMenuAccess([verifyAccessToken(token, NOW.getTime())!]);
    const result = await loadPublicMenu({ bar: 'bar', now: NOW, output: 'monitor', access });
    expect(result.kind).toBe('menu');
    expect((state.renders[0] as RenderGuestMenuInput).accessToken).toBe(token);
  });

  it('the preview token bypasses the code', async () => {
    const result = await loadPublicMenu({ bar: 'bar', menuSlug: 'event', previewToken: 'preview-m1', now: NOW });
    expect(result.kind).toBe('menu');
    if (result.kind === 'menu') expect(result.isPreview).toBe(true);
  });

  it('unprotected menus stay public', async () => {
    const result = await loadPublicMenu({ bar: 'bar', menuSlug: 'abend', now: NOW });
    expect(result.kind).toBe('menu');
    if (result.kind === 'menu') expect(result.isProtected).toBe(false);
  });
});
