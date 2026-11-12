/**
 * Workspace UI translations (setting `translations`, a JSON blob
 * `{ [lang]: { [key]: text } }`). The read-modify-write is serialized per
 * workspace with an advisory lock so concurrent edits don't lose updates.
 */
import { lockWorkspaceScope, runTx, type Tx } from '@lib/db/tx';

export type TranslationMap = { [lang: string]: string };

type TranslationCatalog = { [lang: string]: { [key: string]: string } };

/** Keys that would reach `Object.prototype` through plain-object assignment. */
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Parses the stored blob into null-prototype objects, dropping anything malformed. */
export function parseTranslationCatalog(raw: string | null | undefined): TranslationCatalog {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw ?? '{}');
  } catch {
    parsed = {};
  }
  const catalog: TranslationCatalog = Object.create(null);
  if (!isPlainRecord(parsed)) return catalog;
  for (const [lang, entries] of Object.entries(parsed)) {
    if (UNSAFE_KEYS.has(lang) || !isPlainRecord(entries)) continue;
    const texts: { [key: string]: string } = Object.create(null);
    for (const [key, text] of Object.entries(entries)) {
      if (!UNSAFE_KEYS.has(key) && typeof text === 'string') texts[key] = text;
    }
    catalog[lang] = texts;
  }
  return catalog;
}

/** Merges `translations` for `key` into the workspace blob. Must run inside a transaction. */
export async function updateTranslation(tx: Tx, workspaceId: string, key: string, translations: TranslationMap) {
  await lockWorkspaceScope(tx, workspaceId, 'workspace-translations');
  const existing = await tx.workspaceSetting.findFirst({ where: { workspaceId, setting: 'translations' } });
  const catalog = parseTranslationCatalog(existing?.value);

  if (!UNSAFE_KEYS.has(key)) {
    for (const [lang, text] of Object.entries(translations)) {
      if (UNSAFE_KEYS.has(lang)) continue;
      catalog[lang] ??= Object.create(null);
      catalog[lang][key] = text;
    }
  }

  const value = JSON.stringify(catalog);
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
