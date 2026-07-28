import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiError } from '@lib/http/ApiError';
import { GlassDtoSchema } from '@lib/schemas/glasses';

const mockPrisma = vi.hoisted(() => ({
  glass: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  glassImage: {
    create: vi.fn(),
    deleteMany: vi.fn(),
    findFirst: vi.fn(),
  },
  cocktailRecipe: {
    findMany: vi.fn(),
  },
  $transaction: vi.fn(),
}));

mockPrisma.$transaction.mockImplementation((fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma));

vi.mock('../../../prisma/prisma', () => ({ default: mockPrisma }));
vi.mock('@lib/auditLog', () => ({ createLog: vi.fn() }));

import * as glassesController from '@lib/api/controllers/glasses';

const workspace = { id: 'ws-1', name: 'Bar' } as never;
const user = { id: 'user-1', name: 'Tester' } as never;

describe('glasses controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listGlasses', () => {
    it('returns DTOs for all glasses in workspace', async () => {
      mockPrisma.glass.findMany.mockResolvedValue([
        { id: 'g1', name: 'Tumbler', notes: null, volume: 20, deposit: 0, workspaceId: 'ws-1', _count: { GlassImage: 0 } },
      ]);

      const result = await glassesController.listGlasses(workspace, {});
      expect(result).toHaveLength(1);
      expect(GlassDtoSchema.safeParse(result[0]).success).toBe(true);
      expect(result[0]).toMatchObject({ id: 'g1', name: 'Tumbler', hasImage: false });
    });

    it('filters by search term', async () => {
      mockPrisma.glass.findMany.mockResolvedValue([]);
      await glassesController.listGlasses(workspace, { search: 'tumb' });
      expect(mockPrisma.glass.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ name: { contains: 'tumb', mode: 'insensitive' } }) }),
      );
    });
  });

  describe('getGlass', () => {
    it('returns null when glass does not exist', async () => {
      mockPrisma.glass.findUnique.mockResolvedValue(null);
      const result = await glassesController.getGlass(workspace, 'missing');
      expect(result).toBeNull();
    });
  });

  describe('deleteGlass', () => {
    it('throws 409 when glass is referenced by cocktails', async () => {
      mockPrisma.cocktailRecipe.findMany.mockResolvedValue([{ id: 'c1', name: 'Mojito' }]);

      await expect(glassesController.deleteGlass(workspace, user, 'g1')).rejects.toMatchObject({
        status: 409,
        code: 'GLASS_IN_USE',
      });
    });

    it('deletes glass when no references exist', async () => {
      mockPrisma.cocktailRecipe.findMany.mockResolvedValue([]);
      mockPrisma.glass.findUnique.mockResolvedValue({ id: 'g1', GlassImage: [] });
      mockPrisma.glass.delete.mockResolvedValue({ id: 'g1' });

      const result = await glassesController.deleteGlass(workspace, user, 'g1');
      expect(result).toEqual({ count: 1 });
    });
  });

  describe('checkGlass', () => {
    it('returns null for names shorter than 3 characters', async () => {
      const result = await glassesController.checkGlass(workspace, 'ab');
      expect(result).toBeNull();
      expect(mockPrisma.glass.findMany).not.toHaveBeenCalled();
    });
  });

  describe('exportGlassesJson', () => {
    it('throws 404 when no glasses match', async () => {
      mockPrisma.glass.findMany.mockResolvedValue([]);
      await expect(glassesController.exportGlassesJson(workspace, ['missing'])).rejects.toBeInstanceOf(ApiError);
    });
  });

  describe('importGlassesJson', () => {
    it('validates export data in validate phase', async () => {
      const result = await glassesController.importGlassesJson(workspace, user, {
        phase: 'validate',
        exportData: { glass: { name: 'New Glass' } } as never,
      });
      expect(result).toMatchObject({ valid: true });
    });

    it('throws for invalid phase', async () => {
      await expect(
        glassesController.importGlassesJson(workspace, user, {
          phase: 'invalid' as never,
          exportData: {} as never,
        }),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });
  });
});
