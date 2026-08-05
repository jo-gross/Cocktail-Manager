/**
 * Version-agnostic business logic for workspace translations (v1). Delegates writes
 * to the shared `updateTranslation` helper (still colocated with the legacy route,
 * and reused by the ice/action controllers) and returns clean DTOs.
 */
import prisma from '../../../prisma/prisma';
import { updateTranslation } from '../../../pages/api/workspaces/[workspaceId]/admin/translation';
import type { Workspace } from '@generated/prisma/client';
import type { TranslationUpdateInput, TranslationsDto } from '@lib/schemas/translations';

export async function getTranslations(workspace: Workspace): Promise<TranslationsDto> {
  const row = await prisma.workspaceSetting.findFirst({
    where: { workspaceId: workspace.id, setting: 'translations' },
  });
  try {
    const parsed = JSON.parse(row?.value ?? '{}') as TranslationsDto;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export async function setTranslation(workspace: Workspace, input: TranslationUpdateInput): Promise<{ ok: boolean }> {
  await updateTranslation(workspace.id, input.key, input.translations);
  return { ok: true };
}
