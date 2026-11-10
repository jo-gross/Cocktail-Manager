/**
 * Fallback resolution for workspace label translations (display names of
 * units, preparation actions, action groups and ice). Pure module – shared by
 * the client (`UserContext.getTranslation`) and server-side renderers (PDF export).
 */
import type { ContentLocales } from '@lib/workspace/workspaceLocaleSettings';

/** Catalog as stored in the `translations` workspace setting: locale → key → label. */
export type LabelCatalog = Partial<Record<string, Partial<Record<string, string>> | undefined>>;

/** Legacy safety net for catalogs created before content languages existed. */
const LEGACY_FALLBACK_LOCALE = 'de';

function labelIn(translations: LabelCatalog | undefined, locale: string, key: string): string | undefined {
  const value = translations?.[locale]?.[key];
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

/**
 * Resolves the label for `key`, or `undefined` if no locale has a (non-blank) value:
 * preferred locale (only if it is an active content language) → primary content language →
 * other active content languages → `de` (legacy). Without known content locales
 * (`null`/`undefined`) the chain is preferred locale → `de`.
 */
export function resolveLabelOrNull(
  translations: LabelCatalog | undefined,
  key: string,
  preferredLocale: string | undefined,
  contentLocales: ContentLocales | null | undefined,
): string | undefined {
  const candidates: string[] = [];
  if (contentLocales) {
    const active = [contentLocales.primary, ...contentLocales.additional];
    if (preferredLocale && active.includes(preferredLocale)) candidates.push(preferredLocale);
    candidates.push(...active);
  } else if (preferredLocale) {
    candidates.push(preferredLocale);
  }
  candidates.push(LEGACY_FALLBACK_LOCALE);

  for (const locale of new Set(candidates)) {
    const value = labelIn(translations, locale, key);
    if (value !== undefined) return value;
  }
  return undefined;
}

/** Like `resolveLabelOrNull`, but returns the raw key if no label exists. */
export function resolveLabel(
  translations: LabelCatalog | undefined,
  key: string,
  preferredLocale: string | undefined,
  contentLocales: ContentLocales | null | undefined,
): string {
  return resolveLabelOrNull(translations, key, preferredLocale, contentLocales) ?? key;
}
