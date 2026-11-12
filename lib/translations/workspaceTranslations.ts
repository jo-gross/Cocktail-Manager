/**
 * Workspace UI translations (setting `translations`, a JSON blob
 * `{ [lang]: { [key]: text } }`). The read-modify-write is serialized per
 * workspace with an advisory lock so concurrent edits don't lose updates.
 */
import { lockWorkspaceScope, runTx, type Tx } from '@lib/db/tx';

export type TranslationMap = { [lang: string]: string };

/** Merges `translations` for `key` into the workspace blob. Must run inside a transaction. */
export async function updateTranslation(tx: Tx, workspaceId: string, key: string, translations: TranslationMap) {
  await lockWorkspaceScope(tx, workspaceId, 'workspace-translations');
  const existing = await tx.workspaceSetting.findFirst({ where: { workspaceId, setting: 'translations' } });
  let parsed: { [lang: string]: { [key: string]: string } } = {};
  try {
    parsed = JSON.parse(existing?.value ?? '{}') ?? {};
  } catch {
    parsed = {};
  }

  for (const lang in translations) {
    if (!parsed[lang]) parsed[lang] = {};
    parsed[lang][key] = translations[lang];
  }

  const value = JSON.stringify(parsed);
  return tx.workspaceSetting.upsert({
    where: { workspaceId_setting: { setting: 'translations', workspaceId } },
    create: { workspaceId, setting: 'translations', value },
    update: { value },
  });
}

/** Standalone variant that opens its own transaction. */
export function updateTranslationAtomic(workspaceId: string, key: string, translations: TranslationMap) {
  return runTx((tx) => updateTranslation(tx, workspaceId, key, translations));
}
