/**
 * Guest UI strings (`guest` + `guestInfo` namespaces) for the Liquid `t` filter
 * and the guest shell, without depending on the app's i18next instance (guest
 * pages pick their own language). Per-menu overrides (`document.uiTexts`,
 * resolved into `PublicMenuDto.uiTexts`) win over the bundled strings.
 */
import guestDe from '../../../locales/de/guest.json';
import guestEn from '../../../locales/en/guest.json';
import guestInfoDe from '../../../locales/de/guestInfo.json';
import guestInfoEn from '../../../locales/en/guestInfo.json';

export type GuestUiLocale = 'de' | 'en';
export const GUEST_UI_LOCALES: readonly GuestUiLocale[] = ['de', 'en'];

type Dict = { [key: string]: string | Dict };

const BUNDLES: Record<GuestUiLocale, Record<'guest' | 'guestInfo', Dict>> = {
  de: { guest: guestDe as Dict, guestInfo: guestInfoDe as Dict },
  en: { guest: guestEn as Dict, guestInfo: guestInfoEn as Dict },
};

/** Guest UI language: `de` for German content locales, else `en` (spec: fallback en). */
export function toGuestUiLocale(locale: string | null | undefined): GuestUiLocale {
  const base = (locale ?? '').toLowerCase().split('-')[0];
  return base === 'de' ? 'de' : 'en';
}

function lookup(dict: Dict, path: string): string | undefined {
  let current: string | Dict | undefined = dict;
  for (const part of path.split('.')) {
    if (current == null || typeof current === 'string') return undefined;
    current = current[part];
  }
  return typeof current === 'string' ? current : undefined;
}

export function interpolate(template: string, values: Record<string, unknown> = {}): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, name: string) => {
    const value = values[name];
    return value == null ? '' : String(value);
  });
}

/**
 * Translates `key` (`guest` namespace by default, `guestInfo:<key>` for the
 * other one). Supports i18next-style `_one`/`_other` plurals via `values.count`.
 */
export function translateGuestText(key: string, uiLocale: GuestUiLocale, values: Record<string, unknown> = {}, overrides: Record<string, string> = {}): string {
  const override = overrides[key];
  if (override) return interpolate(override, values);

  const [ns, path] = key.includes(':') ? (key.split(':', 2) as ['guest' | 'guestInfo', string]) : (['guest', key] as const);
  const namespace = ns === 'guestInfo' ? 'guestInfo' : 'guest';
  const candidates: string[] = [];
  if (typeof values.count === 'number') candidates.push(`${path}_${values.count === 1 ? 'one' : 'other'}`);
  candidates.push(path);

  for (const locale of [uiLocale, 'en'] as GuestUiLocale[]) {
    for (const candidate of candidates) {
      const text = lookup(BUNDLES[locale][namespace], candidate);
      if (text !== undefined) return interpolate(text, values);
    }
  }
  return key;
}
