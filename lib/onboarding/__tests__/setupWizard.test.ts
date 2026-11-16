import { describe, expect, it } from 'vitest';
import de from '../../../locales/de/onboarding.json';
import en from '../../../locales/en/onboarding.json';
import {
  BUSINESS_TYPES,
  businessTypeEffects,
  businessTypePreselection,
  detectTimezone,
  initialContentLocales,
  initialRegionValues,
  nextSetupStep,
  previousSetupStep,
  setupSteps,
  shouldShowSetupBanner,
  suggestCurrency,
  dayStartForBusinessType,
  isCustomDayStart,
  isValidDayStart,
} from '../setupWizard';

describe('setupSteps', () => {
  it('has all steps for regular workspaces', () => {
    expect(setupSteps({ isExternallyManaged: false })).toEqual(['language', 'basics', 'content', 'team', 'done']);
  });

  it('hides the team step for externally managed workspaces', () => {
    expect(setupSteps({ isExternallyManaged: true })).toEqual(['language', 'basics', 'content', 'done']);
  });
});

describe('business type preselection', () => {
  it('preselects 06:00 as day start for bars and events (they run past midnight)', () => {
    expect(businessTypePreselection('bar')).toEqual({ dayStart: '06:00', skipTeam: false });
    expect(businessTypePreselection('event')).toEqual({ dayStart: '06:00', skipTeam: false });
  });

  it('preselects midnight for restaurants and private use; private use skips the team step', () => {
    expect(businessTypePreselection('restaurant')).toEqual({ dayStart: '00:00', skipTeam: false });
    expect(businessTypePreselection('private')).toEqual({ dayStart: '00:00', skipTeam: true });
  });

  it('keeps everything without a choice', () => {
    for (const type of [null, undefined] as const) {
      expect(businessTypePreselection(type)).toEqual({ dayStart: null, skipTeam: false });
    }
  });
});

describe('day start in the business type step', () => {
  it('follows the business type while the user has not set it', () => {
    expect(dayStartForBusinessType('bar', '00:00', false)).toBe('06:00');
    expect(dayStartForBusinessType('event', '00:00', false)).toBe('06:00');
    expect(dayStartForBusinessType('restaurant', '06:00', false)).toBe('00:00');
    expect(dayStartForBusinessType('private', '06:00', false)).toBe('00:00');
  });

  it('keeps a value the user set', () => {
    expect(dayStartForBusinessType('bar', '05:00', true)).toBe('05:00');
    expect(dayStartForBusinessType('restaurant', '06:00', true)).toBe('06:00');
  });

  it('treats unset and preselected stored values as not set by the user', () => {
    expect(isCustomDayStart(null)).toBe(false);
    expect(isCustomDayStart(undefined)).toBe(false);
    expect(isCustomDayStart('')).toBe(false);
    expect(isCustomDayStart('00:00')).toBe(false);
    expect(isCustomDayStart('06:00')).toBe(false);
    expect(isCustomDayStart('05:00')).toBe(true);
    expect(isCustomDayStart('18:00')).toBe(true);
  });

  it('validates the time format', () => {
    expect(isValidDayStart('06:00')).toBe(true);
    expect(isValidDayStart('6:00')).toBe(false);
    expect(isValidDayStart('')).toBe(false);
  });
});

describe('business type effects', () => {
  it('describes exactly what the preselection changes', () => {
    expect(businessTypeEffects('bar')).toEqual([{ kind: 'dayStart', time: '06:00' }, { kind: 'guestMenuDesign' }]);
    expect(businessTypeEffects('event')).toEqual([{ kind: 'dayStart', time: '06:00' }, { kind: 'guestMenuDesign' }]);
    expect(businessTypeEffects('restaurant')).toEqual([{ kind: 'dayStart', time: '00:00' }, { kind: 'guestMenuDesign' }]);
    expect(businessTypeEffects('private')).toEqual([{ kind: 'dayStart', time: '00:00' }, { kind: 'skipTeam' }, { kind: 'guestMenuDesign' }]);
  });

  it('stays in sync with the rules for every type', () => {
    for (const type of BUSINESS_TYPES) {
      const { dayStart, skipTeam } = businessTypePreselection(type);
      const effects = businessTypeEffects(type);
      expect(effects.find((effect) => effect.kind === 'dayStart')).toEqual(dayStart ? { kind: 'dayStart', time: dayStart } : undefined);
      expect(effects.some((effect) => effect.kind === 'skipTeam')).toBe(skipTeam);
      expect(effects.some((effect) => effect.kind === 'guestMenuDesign')).toBe(true);
    }
  });

  it('has a text for every effect in both languages', () => {
    for (const type of BUSINESS_TYPES) {
      for (const effect of businessTypeEffects(type)) {
        for (const locale of [de, en]) {
          const text = locale.basics.effects[effect.kind];
          expect(text).toBeTruthy();
          if (effect.kind === 'dayStart') expect(text).toContain('{{time}}');
        }
      }
    }
  });
});

describe('step navigation', () => {
  const steps = setupSteps({ isExternallyManaged: false });

  it('moves forward and back', () => {
    expect(nextSetupStep(steps, 'language', { skipTeam: false })).toBe('basics');
    expect(nextSetupStep(steps, 'content', { skipTeam: false })).toBe('team');
    expect(previousSetupStep(steps, 'done', { skipTeam: false })).toBe('team');
    expect(previousSetupStep(steps, 'language', { skipTeam: false })).toBe('language');
    expect(nextSetupStep(steps, 'done', { skipTeam: false })).toBe('done');
  });

  it('skips the team step in both directions when preselected', () => {
    expect(nextSetupStep(steps, 'content', { skipTeam: true })).toBe('done');
    expect(previousSetupStep(steps, 'done', { skipTeam: true })).toBe('content');
  });

  it('leaves the team step without skipping when it is the current step', () => {
    expect(nextSetupStep(steps, 'team', { skipTeam: true })).toBe('done');
  });
});

describe('regional suggestions', () => {
  it('uses a valid browser time zone, else the default', () => {
    expect(detectTimezone('Europe/Zurich')).toBe('Europe/Zurich');
    expect(detectTimezone('Mars/Olympus')).toBe('Europe/Berlin');
    expect(detectTimezone(undefined)).toBe('Europe/Berlin');
  });

  it('suggests the currency of the first known region', () => {
    expect(suggestCurrency(['de-CH', 'de'])).toBe('CHF');
    expect(suggestCurrency(['en-GB'])).toBe('GBP');
    expect(suggestCurrency(['de'])).toBe('EUR');
    expect(suggestCurrency(['en-US'])).toBe('USD');
    expect(suggestCurrency(['xx-invalid-tag-', 'de-AT'])).toBe('EUR');
    expect(suggestCurrency([])).toBe('EUR');
  });

  it('prefers stored settings over browser values', () => {
    expect(initialRegionValues({ timezone: 'Europe/Vienna', currency: 'CHF' }, { timezone: 'UTC', languages: ['en-GB'] })).toEqual({
      timezone: 'Europe/Vienna',
      currency: 'CHF',
    });
    expect(initialRegionValues({ timezone: null, currency: null }, { timezone: 'Europe/London', languages: ['en-GB'] })).toEqual({
      timezone: 'Europe/London',
      currency: 'GBP',
    });
  });
});

describe('initialContentLocales', () => {
  const stored = JSON.stringify({ primary: 'de', additional: ['en'] });

  it('follows the UI language in a first setup', () => {
    expect(initialContentLocales(null, 'en', false)).toEqual({ contentLocales: { primary: 'en', additional: [] }, follow: true });
    expect(initialContentLocales(stored, 'en', false)).toEqual({ contentLocales: { primary: 'de', additional: ['en'] }, follow: true });
  });

  it('keeps the stored or default content languages of a completed setup', () => {
    expect(initialContentLocales(stored, 'en', true)).toEqual({ contentLocales: { primary: 'de', additional: ['en'] }, follow: false });
    // Older workspaces without the setting: their content is in the default language, not in the UI language.
    expect(initialContentLocales(null, 'en', true)).toEqual({ contentLocales: { primary: 'de', additional: [] }, follow: false });
  });
});

describe('shouldShowSetupBanner', () => {
  const open = { setupCompletedAt: null, isTemplate: false, isDemo: false };

  it('shows for admins while the setup is open', () => {
    expect(shouldShowSetupBanner(open, true)).toBe(true);
  });

  it('shows for demo workspaces of the setup mode, not for the set-up full demo', () => {
    expect(shouldShowSetupBanner({ ...open, isDemo: true }, true)).toBe(true);
    expect(shouldShowSetupBanner({ ...open, isDemo: true, setupCompletedAt: '2026-11-15T10:00:00.000Z' }, true)).toBe(false);
  });

  it('hides for non-admins, completed setups and templates', () => {
    expect(shouldShowSetupBanner(open, false)).toBe(false);
    expect(shouldShowSetupBanner({ ...open, setupCompletedAt: '2026-11-15T10:00:00.000Z' }, true)).toBe(false);
    expect(shouldShowSetupBanner({ ...open, isTemplate: true }, true)).toBe(false);
    expect(shouldShowSetupBanner({ ...open, isTemplate: true, isDemo: true }, true)).toBe(false);
    expect(shouldShowSetupBanner(undefined, true)).toBe(false);
  });
});
