/**
 * Version-agnostic business logic for workspace translations (v1). Writes go
 * through the locked read-modify-write in lib/translations/workspaceTranslations
 * (also used by the ice/action/unit controllers inside their transactions).
 */
import prisma from '../../../prisma/prisma';
import { parseTranslationCatalog, updateTranslationAtomic } from '@lib/translations/workspaceTranslations';
import type { Workspace } from '@generated/prisma/client';
import type { TranslationUpdateInput, TranslationsDto } from '@lib/schemas/translations';

export async function getTranslations(workspace: Workspace): Promise<TranslationsDto> {
  const row = await prisma.workspaceSetting.findFirst({
    where: { workspaceId: workspace.id, setting: 'translations' },
  });
  // Spread into plain objects so the JSON response is unaffected by the null prototypes.
  const catalog = parseTranslationCatalog(row?.value);
  return Object.fromEntries(Object.entries(catalog).map(([lang, texts]) => [lang, { ...texts }]));
}

export async function setTranslation(workspace: Workspace, input: TranslationUpdateInput): Promise<{ ok: boolean }> {
  await updateTranslationAtomic(workspace.id, input.key, input.translations);
  return { ok: true };
}
