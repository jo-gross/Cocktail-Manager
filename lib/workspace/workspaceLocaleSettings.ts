/**
 * Workspace-level locale settings used by guest menus (see docs/GUEST-MENU-CONCEPT.md):
 * `timezone` (IANA), `currency` (ISO 4217) and `contentLocales` (JSON
 * `{ primary, additional[] }`). Pure module – no Prisma runtime – so it can be
 * shared by zod schemas, API controllers and client components. Load the raw
 * values with `loadWorkspaceLocaleSettings` (workspaceLocaleSettings.server.ts).
 */
import { z } from 'zod';

export const DEFAULT_WORKSPACE_TIMEZONE = 'Europe/Berlin';
export const DEFAULT_WORKSPACE_CURRENCY = 'EUR';

export interface ContentLocales {
  /** Source language of the content stored on the entities themselves. */
  primary: string;
  /** Additional content languages maintained via translation tables. */
  additional: string[];
}

export const DEFAULT_CONTENT_LOCALES: ContentLocales = { primary: 'de', additional: [] };

export interface WorkspaceLocaleSettings {
  timezone: string;
  currency: string;
  contentLocales: ContentLocales;
}

/** Raw settings map as stored (`WorkspaceSetting.value`) / returned by the settings API. */
export type RawWorkspaceSettings = Partial<Record<string, string | null | undefined>>;

const MAX_ADDITIONAL_CONTENT_LOCALES = 20;

export function isValidTimezone(value: string): boolean {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function isValidCurrency(value: string): boolean {
  if (!/^[A-Z]{3}$/.test(value)) return false;
  const supportedValuesOf = (Intl as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
  if (typeof supportedValuesOf === 'function') {
    return supportedValuesOf('currency').includes(value);
  }
  try {
    new Intl.NumberFormat('en', { style: 'currency', currency: value });
    return true;
  } catch {
    return false;
  }
}

/** Accepts BCP 47 language tags in canonical form, e.g. `de`, `en`, `pt-BR`. */
export function isValidContentLocale(value: string): boolean {
  if (!/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(value)) return false;
  try {
    return Intl.getCanonicalLocales(value)[0] === value;
  } catch {
    return false;
  }
}

const ContentLocaleCode = z.string().refine(isValidContentLocale, { message: 'Invalid locale code (expected e.g. "de", "en" or "pt-BR")' });

export const ContentLocalesSchema = z
  .object({
    primary: ContentLocaleCode,
    additional: z.array(ContentLocaleCode).max(MAX_ADDITIONAL_CONTENT_LOCALES).default([]),
  })
  .superRefine((value, ctx) => {
    if (value.additional.includes(value.primary)) {
      ctx.addIssue({ code: 'custom', path: ['additional'], message: 'Additional locales must not contain the primary locale' });
    }
    if (new Set(value.additional).size !== value.additional.length) {
      ctx.addIssue({ code: 'custom', path: ['additional'], message: 'Additional locales must be unique' });
    }
  });

/**
 * Validates the string value of a workspace setting. Returns an error message
 * or `null` if valid. `null`/empty values are always valid (they clear the
 * setting so the default applies). Keys without specific rules are accepted.
 */
export function validateWorkspaceSettingValue(setting: string, value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  switch (setting) {
    case 'timezone':
      return isValidTimezone(value) ? null : 'timezone must be a valid IANA time zone (e.g. "Europe/Berlin")';
    case 'currency':
      return isValidCurrency(value) ? null : 'currency must be an ISO 4217 code (e.g. "EUR")';
    case 'contentLocales': {
      let json: unknown;
      try {
        json = JSON.parse(value);
      } catch {
        return 'contentLocales must be JSON: { "primary": "de", "additional": ["en"] }';
      }
      const parsed = ContentLocalesSchema.safeParse(json);
      return parsed.success ? null : `contentLocales: ${parsed.error.issues.map((i) => i.message).join(', ')}`;
    }
    default:
      return null;
  }
}

export function parseTimezone(value: string | null | undefined): string {
  return value && isValidTimezone(value) ? value : DEFAULT_WORKSPACE_TIMEZONE;
}

export function parseCurrency(value: string | null | undefined): string {
  return value && isValidCurrency(value) ? value : DEFAULT_WORKSPACE_CURRENCY;
}

export function parseContentLocales(value: string | null | undefined): ContentLocales {
  if (!value) return { ...DEFAULT_CONTENT_LOCALES, additional: [...DEFAULT_CONTENT_LOCALES.additional] };
  try {
    const parsed = ContentLocalesSchema.safeParse(JSON.parse(value));
    if (parsed.success) return parsed.data;
  } catch {
    // fall through to default
  }
  return { ...DEFAULT_CONTENT_LOCALES, additional: [...DEFAULT_CONTENT_LOCALES.additional] };
}

export function serializeContentLocales(value: ContentLocales): string {
  return JSON.stringify(ContentLocalesSchema.parse(value));
}

/** All content locales, primary first. */
export function getAllContentLocales(value: ContentLocales): string[] {
  return [value.primary, ...value.additional.filter((l) => l !== value.primary)];
}

export function getWorkspaceTimezone(settings: RawWorkspaceSettings): string {
  return parseTimezone(settings.timezone);
}

export function getWorkspaceCurrency(settings: RawWorkspaceSettings): string {
  return parseCurrency(settings.currency);
}

export function getWorkspaceContentLocales(settings: RawWorkspaceSettings): ContentLocales {
  return parseContentLocales(settings.contentLocales);
}

export function getWorkspaceLocaleSettings(settings: RawWorkspaceSettings): WorkspaceLocaleSettings {
  return {
    timezone: getWorkspaceTimezone(settings),
    currency: getWorkspaceCurrency(settings),
    contentLocales: getWorkspaceContentLocales(settings),
  };
}
