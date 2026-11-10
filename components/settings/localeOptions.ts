import { DEFAULT_WORKSPACE_CURRENCY, DEFAULT_WORKSPACE_TIMEZONE } from '@lib/workspace/workspaceLocaleSettings';

/** Commonly used content languages offered in the settings (ISO 639-1). */
export const COMMON_CONTENT_LOCALES = [
  'de',
  'en',
  'fr',
  'es',
  'it',
  'nl',
  'pl',
  'pt',
  'cs',
  'da',
  'sv',
  'no',
  'fi',
  'tr',
  'el',
  'hu',
  'ro',
  'hr',
  'ru',
  'uk',
  'ja',
  'zh',
  'ar',
];

const FALLBACK_TIMEZONES = [DEFAULT_WORKSPACE_TIMEZONE, 'Europe/Vienna', 'Europe/Zurich', 'Europe/London', 'UTC'];
const FALLBACK_CURRENCIES = [DEFAULT_WORKSPACE_CURRENCY, 'CHF', 'GBP', 'USD'];

function supportedValues(key: 'timeZone' | 'currency', fallback: string[]): string[] {
  const supportedValuesOf = (Intl as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
  if (typeof supportedValuesOf !== 'function') return fallback;
  try {
    return supportedValuesOf(key);
  } catch {
    return fallback;
  }
}

/** All runtime-supported values, with the current value first if the runtime doesn't know it. */
export function timezoneOptions(current: string): string[] {
  const values = supportedValues('timeZone', FALLBACK_TIMEZONES);
  return values.includes(current) ? values : [current, ...values];
}

export function currencyOptions(current: string): string[] {
  const values = supportedValues('currency', FALLBACK_CURRENCIES);
  return values.includes(current) ? values : [current, ...values];
}

export function displayName(code: string, type: 'language' | 'currency', displayLocale: string): string {
  try {
    return new Intl.DisplayNames([displayLocale || 'de'], { type }).of(code) ?? code;
  } catch {
    return code;
  }
}
