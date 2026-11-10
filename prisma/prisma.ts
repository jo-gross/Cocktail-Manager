import { PrismaClient } from '@generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Secrets that must never leave the server by accident (e.g. via `workspace: true`
 * includes or full-row responses). Read them explicitly with
 * `select: { signageKey: true }`.
 */
export const PRISMA_GLOBAL_OMIT = {
  workspace: { signageKey: true },
} as const;

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter, omit: PRISMA_GLOBAL_OMIT });
}

export type AppPrismaClient = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as { prisma: AppPrismaClient | undefined };

let prisma: AppPrismaClient;

if (process.env.NODE_ENV === 'production') {
  prisma = createPrismaClient();
} else {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  prisma = globalForPrisma.prisma;
}

export default prisma;
