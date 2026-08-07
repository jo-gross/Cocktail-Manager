export const SUPPORTED_LOCALES = ['de', 'en'] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = 'de';

/** Unicode regional flags shown next to locale names in the UI. */
export const LOCALE_FLAGS: Record<AppLocale, string> = {
  de: '🇩🇪',
  en: '🇬🇧',
};

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return value === 'de' || value === 'en';
}

export function normalizeLocale(value: string | null | undefined): AppLocale {
  if (!value) return DEFAULT_LOCALE;
  const base = value.toLowerCase().split('-')[0];
  return isAppLocale(base) ? base : DEFAULT_LOCALE;
}
