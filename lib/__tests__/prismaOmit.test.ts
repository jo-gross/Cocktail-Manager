/** Secrets are globally omitted from Prisma results (never leaked via `workspace: true` / full rows). */
import { describe, expect, it, vi } from 'vitest';

const captured = vi.hoisted(() => ({ options: undefined as unknown }));

vi.mock('@generated/prisma/client', () => ({
  PrismaClient: vi.fn(function PrismaClient(this: unknown, options: unknown) {
    captured.options = options;
  }),
}));
vi.mock('@prisma/adapter-pg', () => ({ PrismaPg: vi.fn(function PrismaPg() {}) }));

describe('prisma client', () => {
  it('omits Workspace.signageKey globally', async () => {
    const { PRISMA_GLOBAL_OMIT } = await import('../../prisma/prisma');
    expect(PRISMA_GLOBAL_OMIT.workspace.signageKey).toBe(true);
    expect(captured.options).toMatchObject({ omit: { workspace: { signageKey: true } } });
  });
});
