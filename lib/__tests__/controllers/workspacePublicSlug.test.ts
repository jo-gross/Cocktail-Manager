/** Public slug reservation (`/m/{workspaceId}` must never be taken over by a slug). */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@lib/http/ApiError';
import { isReservedPublicSlug } from '@lib/schemas/workspace';

const mockPrisma = vi.hoisted(() => ({
  workspace: { findFirst: vi.fn(), findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
  workspaceSetting: { findMany: vi.fn() },
  workspaceUser: { findMany: vi.fn() },
}));

vi.mock('../../../prisma/prisma', () => ({ default: mockPrisma }));

const { updateWorkspace } = await import('@lib/api/controllers/workspace');
const { findPublicWorkspace } = await import('@lib/guest-menu/server');

const workspace = { id: 'cmh0000000000000000000001', name: 'Bar', publicSlug: null } as never;

async function expectApiError(promise: Promise<unknown>, status: number, code: string) {
  const error = await promise.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(ApiError);
  expect(error).toMatchObject({ status, code });
}

describe('isReservedPublicSlug', () => {
  it('reserves cuid and uuid shaped slugs', () => {
    expect(isReservedPublicSlug('cmh1a2b3c4d5e6f7g8h9i0j1k')).toBe(true);
    expect(isReservedPublicSlug('c12345678901234567890')).toBe(true);
    expect(isReservedPublicSlug('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
  });

  it('allows normal slugs', () => {
    expect(isReservedPublicSlug('meine-bar')).toBe(false);
    expect(isReservedPublicSlug('cocktailbar')).toBe(false);
    expect(isReservedPublicSlug('cocktail-bar-im-zentrum-von-berlin')).toBe(false);
  });
});

describe('updateWorkspace – public slug', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.workspace.findUniqueOrThrow.mockResolvedValue({ id: 'ws', name: 'Bar', publicSlug: 'bar', image: null });
    mockPrisma.workspaceSetting.findMany.mockResolvedValue([]);
    mockPrisma.workspaceUser.findMany.mockResolvedValue([]);
  });

  it('rejects id-shaped slugs with 400 PUBLIC_SLUG_RESERVED', async () => {
    await expectApiError(updateWorkspace(workspace, { publicSlug: 'cmh1a2b3c4d5e6f7g8h9i0j1k' }), 400, 'PUBLIC_SLUG_RESERVED');
    expect(mockPrisma.workspace.update).not.toHaveBeenCalled();
  });

  it('rejects slugs used by another workspace or equal to a workspace id with 409 PUBLIC_SLUG_TAKEN', async () => {
    mockPrisma.workspace.findFirst.mockResolvedValue({ id: 'other' });
    await expectApiError(updateWorkspace(workspace, { publicSlug: 'bar' }), 409, 'PUBLIC_SLUG_TAKEN');
    expect(mockPrisma.workspace.findFirst).toHaveBeenCalledWith({
      where: { OR: [{ publicSlug: 'bar', id: { not: 'cmh0000000000000000000001' } }, { id: 'bar' }] },
      select: { id: true },
    });
    expect(mockPrisma.workspace.update).not.toHaveBeenCalled();
  });

  it('saves a free slug', async () => {
    mockPrisma.workspace.findFirst.mockResolvedValue(null);
    await updateWorkspace(workspace, { publicSlug: 'bar' });
    expect(mockPrisma.workspace.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ publicSlug: 'bar' }) }));
  });
});

describe('findPublicWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves the workspace id before the public slug', async () => {
    mockPrisma.workspace.findUnique.mockImplementation(async ({ where }: { where: { id?: string; publicSlug?: string } }) =>
      where.id === 'ws-a'
        ? { id: 'ws-a', name: 'A', publicSlug: null, image: null }
        : where.publicSlug === 'ws-a'
          ? { id: 'ws-b', name: 'B', publicSlug: 'ws-a', image: null }
          : null,
    );
    expect(await findPublicWorkspace('ws-a')).toMatchObject({ id: 'ws-a' });
    expect(mockPrisma.workspace.findUnique).toHaveBeenCalledTimes(1);
    expect(mockPrisma.workspace.findUnique.mock.calls[0][0].where).toEqual({ id: 'ws-a' });
  });

  it('falls back to the public slug', async () => {
    mockPrisma.workspace.findUnique.mockImplementation(async ({ where }: { where: { id?: string; publicSlug?: string } }) =>
      where.publicSlug === 'bar' ? { id: 'ws-b', name: 'B', publicSlug: 'bar', image: 'data:' } : null,
    );
    expect(await findPublicWorkspace('bar')).toEqual({ id: 'ws-b', name: 'B', publicSlug: 'bar', hasImage: true });
  });
});
