import { describe, expect, it } from 'vitest';
import {
  businessTypePreselection,
  detectTimezone,
  initialContentLocales,
  initialRegionValues,
  nextSetupStep,
  previousSetupStep,
  setupSteps,
  shouldShowSetupBanner,
  suggestCurrency,
  suggestedDayStart,
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
  it('suggests 06:00 as day start for bars', () => {
    expect(businessTypePreselection('bar')).toEqual({ dayStart: '06:00', skipTeam: false });
  });

  it('skips the team step for private use', () => {
    expect(businessTypePreselection('private')).toEqual({ dayStart: null, skipTeam: true });
  });

  it('keeps everything for the other types and without a choice', () => {
    for (const type of ['restaurant', 'event', null, undefined] as const) {
      expect(businessTypePreselection(type)).toEqual({ dayStart: null, skipTeam: false });
    }
  });

  it('only suggests the day start while the default is used', () => {
    expect(suggestedDayStart('bar', null)).toBe('06:00');
    expect(suggestedDayStart('bar', '00:00')).toBe('06:00');
    expect(suggestedDayStart('bar', '05:00')).toBeNull();
    expect(suggestedDayStart('bar', '06:00')).toBeNull();
    expect(suggestedDayStart('restaurant', '00:00')).toBeNull();
    expect(suggestedDayStart(null, '00:00')).toBeNull();
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
    expect(
      initialRegionValues({ timezone: 'Europe/Vienna', currency: 'CHF', statisticDayStartTime: '05:00' }, { timezone: 'UTC', languages: ['en-GB'] }),
    ).toEqual({
      timezone: 'Europe/Vienna',
      currency: 'CHF',
      dayStart: '05:00',
    });
    expect(initialRegionValues({ timezone: null, currency: null, statisticDayStartTime: null }, { timezone: 'Europe/London', languages: ['en-GB'] })).toEqual({
      timezone: 'Europe/London',
      currency: 'GBP',
      dayStart: '00:00',
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
