/**
 * Setup state and checklist of a workspace (docs/plans/ONBOARDING-PLAN.md §2/§4).
 * The checklist is computed from the data on every request – nothing is stored.
 */
import type { Workspace } from '@generated/prisma/client';
import { Prisma } from '@generated/prisma/client';
import prisma from '../../../prisma/prisma';
import type { OnboardingChecklistItem, OnboardingDto } from '@lib/schemas/onboarding';

export async function getOnboarding(workspace: Pick<Workspace, 'id'>): Promise<OnboardingDto> {
  const workspaceId = workspace.id;
  const [row, glasses, ingredients, cocktails, cards, cocktailsWithoutPrice, unconfirmedIngredients, unconfirmedGarnishes, members, joinCodes, guestMenus] =
    await Promise.all([
      prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { setupCompletedAt: true } }),
      prisma.glass.count({ where: { workspaceId } }),
      prisma.ingredient.count({ where: { workspaceId } }),
      prisma.cocktailRecipe.count({ where: { workspaceId, isArchived: false } }),
      prisma.cocktailCard.count({ where: { workspaceId, archived: false } }),
      prisma.cocktailRecipe.count({ where: { workspaceId, isArchived: false, price: null } }),
      prisma.ingredient.count({ where: { workspaceId, guestInfoComplete: false } }),
      prisma.garnish.count({ where: { workspaceId, guestInfoComplete: false } }),
      prisma.workspaceUser.count({ where: { workspaceId } }),
      prisma.workspaceJoinCode.count({ where: { workspaceId } }),
      prisma.guestMenu.count({ where: { workspaceId, enabled: true, published: { not: Prisma.DbNull } } }),
    ]);

  const item = (id: OnboardingChecklistItem['id'], done: boolean, open: number): OnboardingChecklistItem => ({ id, done, open: done ? 0 : open });
  const unconfirmed = unconfirmedIngredients + unconfirmedGarnishes;
  return {
    setupCompletedAt: row.setupCompletedAt?.toISOString() ?? null,
    checklist: [
      item('glasses', glasses > 0, 1),
      item('ingredients', ingredients > 0, 1),
      item('cocktails', cocktails > 0, 1),
      item('cards', cards > 0, 1),
      item('prices', cocktails > 0 && cocktailsWithoutPrice === 0, cocktails > 0 ? cocktailsWithoutPrice : 1),
      item('guestInfo', ingredients > 0 && unconfirmed === 0, ingredients > 0 ? unconfirmed : 1),
      item('team', members > 1 || joinCodes > 0, 1),
      item('guestMenu', guestMenus > 0, 1),
    ],
  };
}

/** Idempotent: keeps the first completion time. */
export async function completeOnboarding(workspace: Pick<Workspace, 'id'>): Promise<OnboardingDto> {
  await prisma.workspace.updateMany({ where: { id: workspace.id, setupCompletedAt: null }, data: { setupCompletedAt: new Date() } });
  return getOnboarding(workspace);
}
