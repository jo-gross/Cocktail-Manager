/**
 * Current usage of one workspace per limit key, with the definitions of the instance API (docs/INSTANCE-API.md
 * "Usage counts"). Takes a transaction client so guards count inside the transaction of the write.
 */
import { Prisma } from '@generated/prisma/client';
import type { Db } from '@lib/db/tx';
import { LIMIT_KEYS, type LimitKey } from './snapshot';

export async function countUsage(db: Db, workspaceId: string, key: LimitKey): Promise<number> {
  switch (key) {
    case 'cocktails':
      return db.cocktailRecipe.count({ where: { workspaceId, isArchived: false } });
    case 'members':
      return db.workspaceUser.count({ where: { workspaceId } });
    case 'calculations':
      return db.cocktailCalculation.count({ where: { workspaceId } });
    case 'guestMenusPublished':
      return db.guestMenu.count({ where: { workspaceId, NOT: { published: { equals: Prisma.DbNull } } } });
    case 'signageScreens':
      return db.signage.count({ where: { workspaceId } });
    case 'apiKeys':
      return db.workspaceApiKey.count({ where: { workspaceId, revoked: false, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } });
  }
}

/** All counts, sequentially (`db` may be a transaction client). */
export async function countAllUsage(db: Db, workspaceId: string): Promise<Record<LimitKey, number>> {
  const usage = {} as Record<LimitKey, number>;
  for (const key of LIMIT_KEYS) usage[key] = await countUsage(db, workspaceId, key);
  return usage;
}
