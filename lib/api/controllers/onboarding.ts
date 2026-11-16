/**
 * Setup state and checklist of a workspace (docs/plans/ONBOARDING-PLAN.md §2/§4).
 * The checklist is computed from the data on every request; only the items a manager
 * marked as done without doing them are stored (setting `onboardingChecklistSkipped`).
 */
import type { Workspace } from '@generated/prisma/client';
import { Prisma, WorkspaceSettingKey } from '@generated/prisma/client';
import prisma from '../../../prisma/prisma';
import { runTx, lockWorkspaceScope } from '@lib/db/tx';
import type { OnboardingChecklistItem, OnboardingChecklistItemId, OnboardingDto } from '@lib/schemas/onboarding';
import { parseChecklistSkipped, serializeChecklistSkipped } from '@lib/onboarding/checklistItems';

const skippedSettingKey = (workspaceId: string) => ({ workspaceId_setting: { workspaceId, setting: WorkspaceSettingKey.onboardingChecklistSkipped } });

export async function getOnboarding(workspace: Pick<Workspace, 'id'>): Promise<OnboardingDto> {
  const workspaceId = workspace.id;
  const [
    row,
    skippedSetting,
    glasses,
    ingredients,
    cocktails,
    cards,
    cocktailsWithoutPrice,
    unconfirmedIngredients,
    unconfirmedGarnishes,
    members,
    joinCodes,
    guestMenus,
  ] = await Promise.all([
    prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { setupCompletedAt: true } }),
    prisma.workspaceSetting.findUnique({ where: skippedSettingKey(workspaceId), select: { value: true } }),
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

  const skipped = new Set(parseChecklistSkipped(skippedSetting?.value));
  const item = (id: OnboardingChecklistItem['id'], done: boolean, open: number): OnboardingChecklistItem => ({
    id,
    done,
    skipped: skipped.has(id),
    open: done ? 0 : open,
  });
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

/** Marks a checklist item as done without doing it (or reverts that) for the whole workspace. Idempotent. */
export async function setChecklistItemSkipped(workspace: Pick<Workspace, 'id'>, itemId: OnboardingChecklistItemId, skipped: boolean): Promise<OnboardingDto> {
  await runTx(async (tx) => {
    // Read-modify-write of a JSON list: serialize concurrent toggles of different items.
    await lockWorkspaceScope(tx, workspace.id, 'onboarding-checklist-skipped');
    const current = await tx.workspaceSetting.findUnique({ where: skippedSettingKey(workspace.id), select: { value: true } });
    const ids = new Set(parseChecklistSkipped(current?.value));
    if (skipped) ids.add(itemId);
    else ids.delete(itemId);
    const value = serializeChecklistSkipped(ids);
    if (value === null) {
      await tx.workspaceSetting.deleteMany({ where: { workspaceId: workspace.id, setting: WorkspaceSettingKey.onboardingChecklistSkipped } });
    } else {
      await tx.workspaceSetting.upsert({
        where: skippedSettingKey(workspace.id),
        create: { workspaceId: workspace.id, setting: WorkspaceSettingKey.onboardingChecklistSkipped, value },
        update: { value },
      });
    }
  });
  return getOnboarding(workspace);
}
