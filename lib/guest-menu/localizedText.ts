/** `LocalizedText = Record<locale, string>` as used throughout the guest menu document. */
export type LocalizedText = Record<string, string>;

/**
 * Fallback chain from the spec: requested locale → primary (source) locale →
 * any non-empty value → `fallback`. Accepts `pt-BR`-style locales and falls back
 * to their base language (`pt`) before the primary locale.
 */
export function resolveLocalizedText(text: LocalizedText | null | undefined, locale: string, primaryLocale: string, fallback = ''): string {
  if (!text) return fallback;
  const candidates = [locale, locale.split('-')[0], primaryLocale];
  for (const candidate of candidates) {
    const value = text[candidate];
    if (value && value.trim() !== '') return value;
  }
  for (const value of Object.values(text)) {
    if (value && value.trim() !== '') return value;
  }
  return fallback;
}

export function localizedText(locale: string, value: string): LocalizedText {
  return { [locale]: value };
}

export function isLocalizedTextEmpty(text: LocalizedText | null | undefined): boolean {
  return !text || Object.values(text).every((v) => !v || v.trim() === '');
}
