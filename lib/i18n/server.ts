import { resources } from './config';
import { normalizeLocale, type AppLocale } from './locales';

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

/** Fixed-locale `t` for server-side rendering (PDF HTML, etc.). */
export function getServerT(locale?: string | null): { t: TranslateFn; locale: AppLocale } {
  const normalized = normalizeLocale(locale);

  const t: TranslateFn = (key, options) => {
    const [ns, nested] = key.includes(':') ? (key.split(':') as [string, string]) : ['common', key];
    const bag = (resources as Record<string, Record<string, unknown>>)[normalized]?.[ns];
    if (bag && typeof bag === 'object') {
      const parts = nested.split('.');
      let current: unknown = bag;
      for (const part of parts) {
        if (current && typeof current === 'object' && part in (current as object)) {
          current = (current as Record<string, unknown>)[part];
        } else {
          current = undefined;
          break;
        }
      }
      if (typeof current === 'string') {
        if (!options) return current;
        return current.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(options[name] ?? ''));
      }
    }
    return key;
  };

  return { t, locale: normalized };
}
