/**
 * Version-agnostic business logic for workspace translations (v1). Delegates to the
 * shared `updateTranslation` helper (still colocated with the legacy route, and reused
 * by the ice/action controllers) and returns a clean result instead of the raw setting row.
 */
import { updateTranslation } from '../../../pages/api/workspaces/[workspaceId]/admin/translation';
import type { Workspace } from '@generated/prisma/client';
import type { TranslationUpdateInput } from '@lib/schemas/translations';

export async function setTranslation(workspace: Workspace, input: TranslationUpdateInput): Promise<{ ok: boolean }> {
  await updateTranslation(workspace.id, input.key, input.translations);
  return { ok: true };
}
