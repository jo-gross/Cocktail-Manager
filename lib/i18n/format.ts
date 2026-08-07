import type { AppLocale } from './locales';
import { normalizeLocale } from './locales';

/** Maps app locale codes to BCP 47 tags used by Intl / toLocaleString. */
export function toIntlLocale(locale: string | AppLocale | undefined): string {
  const normalized = normalizeLocale(locale);
  return normalized === 'en' ? 'en-US' : 'de-DE';
}
