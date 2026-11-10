/** Draft preview token: visibility for API keys, regeneration + audit log (never the token value). */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultGuestMenuDocument } from '@lib/guest-menu/schema';

const mockPrisma = vi.hoisted(() => ({
  guestMenu: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  workspaceUser: { findFirst: vi.fn() },
}));
const createLog = vi.hoisted(() => vi.fn());

vi.mock('../../../prisma/prisma', () => ({ default: mockPrisma }));
vi.mock('@lib/auditLog', () => ({ createLog }));
vi.mock('@lib/guest-menu/resolve', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@lib/guest-menu/resolve')>()),
  loadWorkspaceGuestSettings: vi.fn(async () => ({ timezone: 'UTC', currency: 'EUR', contentLocales: { primary: 'de', additional: [] }, dayStartTime: null })),
}));

const { getGuestMenu, regenerateGuestMenuPreviewToken } = await import('@lib/api/controllers/guestMenus');

const workspace = { id: 'ws1', name: 'Bar', publicSlug: 'bar', image: null } as never;
const user = { id: 'creator' };
const document = createDefaultGuestMenuDocument({ title: 'Karte' });
const menu = {
  id: 'menu1',
  workspaceId: 'ws1',
  name: 'Karte',
  slug: 'karte',
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
  published: null,
  publishedAt: null,
  previewToken: 'old-token',
  accessCodeHash: null,
  accessCodeVersion: 0,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.guestMenu.findFirst.mockResolvedValue(menu);
  mockPrisma.guestMenu.findMany.mockResolvedValue([menu]);
  // The key's creator is an ADMIN – must not matter for API keys.
  mockPrisma.workspaceUser.findFirst.mockResolvedValue({ role: 'ADMIN' });
});

describe('preview token visibility', () => {
  it('shows it to MANAGER+ sessions', async () => {
    expect((await getGuestMenu(workspace, 'menu1', user)).previewToken).toBe('old-token');
    mockPrisma.workspaceUser.findFirst.mockResolvedValue({ role: 'USER' });
    expect((await getGuestMenu(workspace, 'menu1', user)).previewToken).toBeNull();
  });

  it('requires GUEST_MENUS_UPDATE for API keys instead of the creator role', async () => {
    expect((await getGuestMenu(workspace, 'menu1', user, ['GUEST_MENUS_READ'])).previewToken).toBeNull();
    expect((await getGuestMenu(workspace, 'menu1', user, ['GUEST_MENUS_READ', 'GUEST_MENUS_UPDATE'])).previewToken).toBe('old-token');
    expect((await getGuestMenu(workspace, 'menu1', user, 'all')).previewToken).toBe('old-token');
  });
});

describe('regenerateGuestMenuPreviewToken', () => {
  it('stores a new random token and logs it without the value', async () => {
    mockPrisma.guestMenu.update.mockImplementation(async ({ data }: { data: { previewToken: string } }) => ({
      ...menu,
      previewToken: data.previewToken,
      updatedAt: new Date('2026-02-01T00:00:00Z'),
    }));
    const dto = await regenerateGuestMenuPreviewToken(workspace, 'menu1', user);
    const token = mockPrisma.guestMenu.update.mock.calls[0][0].data.previewToken as string;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(dto.previewToken).toBe(token);
    expect(createLog).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify(createLog.mock.calls[0]);
    expect(logged).not.toContain(token);
    expect(logged).not.toContain('old-token');
    expect(createLog.mock.calls[0][7]).toMatchObject({ previewTokenRegeneratedAt: '2026-02-01T00:00:00.000Z' });
  });
});
