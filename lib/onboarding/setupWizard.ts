/**
 * Pure rules of the setup wizard (`/workspaces/[id]/setup`, docs/plans/ONBOARDING-PLAN.md §2):
 * steps, preselection by business type and regional suggestions. No React, no network.
 */
import {
  DEFAULT_WORKSPACE_CURRENCY,
  DEFAULT_WORKSPACE_TIMEZONE,
  isValidCurrency,
  isValidTimezone,
  parseContentLocales,
  type ContentLocales,
} from '@lib/workspace/workspaceLocaleSettings';

export const SETUP_STEPS = ['language', 'basics', 'content', 'team', 'done'] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];

/** Not persisted – only drives suggestions in the wizard. */
export const BUSINESS_TYPES = ['bar', 'restaurant', 'event', 'private'] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const DEFAULT_DAY_START = '00:00';

export function isSetupStep(value: unknown): value is SetupStep {
  return typeof value === 'string' && (SETUP_STEPS as readonly string[]).includes(value);
}

export function isBusinessType(value: unknown): value is BusinessType {
  return typeof value === 'string' && (BUSINESS_TYPES as readonly string[]).includes(value);
}

/** Steps shown for a workspace; externally managed workspaces have no team step (members come from the identity provider). */
export function setupSteps(options: { isExternallyManaged: boolean }): SetupStep[] {
  return SETUP_STEPS.filter((step) => step !== 'team' || !options.isExternallyManaged);
}

export interface BusinessTypePreselection {
  /** Suggested start of the statistics day; `null` = keep. */
  dayStart: string | null;
  /** The team step is skipped by "Next" (still reachable via the stepper). */
  skipTeam: boolean;
}

export function businessTypePreselection(type: BusinessType | null | undefined): BusinessTypePreselection {
  switch (type) {
    // Bars close after midnight: the bar day should not end at 00:00.
    case 'bar':
      return { dayStart: '06:00', skipTeam: false };
    case 'private':
      return { dayStart: null, skipTeam: true };
    default:
      return { dayStart: null, skipTeam: false };
  }
}

/** Day start to suggest for the business type, only while the workspace still uses the default. */
export function suggestedDayStart(type: BusinessType | null | undefined, currentDayStart: string | null | undefined): string | null {
  const { dayStart } = businessTypePreselection(type);
  const current = currentDayStart || DEFAULT_DAY_START;
  return dayStart && current === DEFAULT_DAY_START && dayStart !== current ? dayStart : null;
}

/** Step after `current`; skips the team step when the business type says so. */
export function nextSetupStep(steps: readonly SetupStep[], current: SetupStep, options: { skipTeam: boolean }): SetupStep {
  let index = steps.indexOf(current) + 1;
  if (steps[index] === 'team' && options.skipTeam) index += 1;
  return steps[Math.min(index, steps.length - 1)] ?? current;
}

export function previousSetupStep(steps: readonly SetupStep[], current: SetupStep, options: { skipTeam: boolean }): SetupStep {
  let index = steps.indexOf(current) - 1;
  if (steps[index] === 'team' && options.skipTeam) index -= 1;
  return steps[Math.max(index, 0)] ?? current;
}

/**
 * "Continue setup" banner: admins of a workspace whose setup wizard is not completed – also demo
 * workspaces of the "try the setup" mode (the full demo is created as set up); never templates.
 */
export function shouldShowSetupBanner(workspace: { setupCompletedAt: string | null; isTemplate: boolean } | null | undefined, isAdmin: boolean): boolean {
  return !!workspace && isAdmin && workspace.setupCompletedAt === null && !workspace.isTemplate;
}

/** Time zone of the browser if the runtime knows it, else the app default. */
export function detectTimezone(detected: string | null | undefined): string {
  return detected && isValidTimezone(detected) ? detected : DEFAULT_WORKSPACE_TIMEZONE;
}

/** ISO 3166 region → ISO 4217 currency for the regions the app is mostly used in. */
const REGION_CURRENCY: Record<string, string> = {
  AT: 'EUR',
  BE: 'EUR',
  CY: 'EUR',
  DE: 'EUR',
  EE: 'EUR',
  ES: 'EUR',
  FI: 'EUR',
  FR: 'EUR',
  GR: 'EUR',
  HR: 'EUR',
  IE: 'EUR',
  IT: 'EUR',
  LT: 'EUR',
  LU: 'EUR',
  LV: 'EUR',
  MT: 'EUR',
  NL: 'EUR',
  PT: 'EUR',
  SI: 'EUR',
  SK: 'EUR',
  CH: 'CHF',
  LI: 'CHF',
  GB: 'GBP',
  US: 'USD',
  CA: 'CAD',
  AU: 'AUD',
  NZ: 'NZD',
  DK: 'DKK',
  SE: 'SEK',
  NO: 'NOK',
  PL: 'PLN',
  CZ: 'CZK',
  HU: 'HUF',
  RO: 'RON',
  TR: 'TRY',
  JP: 'JPY',
};

/** Region of a BCP 47 tag; language-only tags use the likely region (`de` → `DE`, `en` → `US`). */
function regionOf(tag: string): string | undefined {
  try {
    const locale = new Intl.Locale(tag);
    return locale.region ?? locale.maximize().region;
  } catch {
    return undefined;
  }
}

/** Currency suggestion from the browser languages (first known region wins), default EUR. */
export function suggestCurrency(languages: readonly string[]): string {
  for (const language of languages) {
    const region = regionOf(language);
    const currency = region ? REGION_CURRENCY[region] : undefined;
    if (currency && isValidCurrency(currency)) return currency;
  }
  return DEFAULT_WORKSPACE_CURRENCY;
}

export interface RegionValues {
  timezone: string;
  currency: string;
  dayStart: string;
}

/**
 * Content languages the language step starts with and whether the primary one follows the UI language
 * (`follow`). Only in a first setup: a reopened assistant (setup completed) may already have content in
 * the stored – or, for older workspaces without the setting, the default – primary language.
 */
export function initialContentLocales(
  storedContentLocales: string | null | undefined,
  uiLocale: string,
  setupCompleted: boolean,
): { contentLocales: ContentLocales; follow: boolean } {
  if (setupCompleted) return { contentLocales: parseContentLocales(storedContentLocales), follow: false };
  return { contentLocales: storedContentLocales ? parseContentLocales(storedContentLocales) : { primary: uiLocale, additional: [] }, follow: true };
}

/** Stored values win; unset ones are filled from the browser (time zone, languages). */
export function initialRegionValues(
  settings: Partial<Record<'timezone' | 'currency' | 'statisticDayStartTime', string | null | undefined>>,
  browser: { timezone?: string | null; languages: readonly string[] },
): RegionValues {
  return {
    timezone: settings.timezone || detectTimezone(browser.timezone),
    currency: settings.currency || suggestCurrency(browser.languages),
    dayStart: settings.statisticDayStartTime || DEFAULT_DAY_START,
  };
}
