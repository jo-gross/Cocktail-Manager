import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CONTENT_LOCALES,
  getAllContentLocales,
  getWorkspaceLocaleSettings,
  isValidContentLocale,
  isValidCurrency,
  isValidTimezone,
  parseContentLocales,
  serializeContentLocales,
  validateWorkspaceSettingValue,
} from '../workspaceLocaleSettings';
import { WorkspaceSettingUpdateSchema } from '@lib/schemas/workspace';

describe('workspaceLocaleSettings', () => {
  it('applies defaults for missing or invalid values', () => {
    expect(getWorkspaceLocaleSettings({})).toEqual({ timezone: 'Europe/Berlin', currency: 'EUR', contentLocales: { primary: 'de', additional: [] } });
    expect(getWorkspaceLocaleSettings({ timezone: 'Mars/Base', currency: 'euro', contentLocales: '{nope' })).toEqual(getWorkspaceLocaleSettings({}));
  });

  it('reads valid values', () => {
    expect(
      getWorkspaceLocaleSettings({ timezone: 'America/New_York', currency: 'USD', contentLocales: '{"primary":"en","additional":["de","pt-BR"]}' }),
    ).toEqual({
      timezone: 'America/New_York',
      currency: 'USD',
      contentLocales: { primary: 'en', additional: ['de', 'pt-BR'] },
    });
  });

  it('validates timezones, currencies and locales', () => {
    expect(isValidTimezone('Europe/Berlin')).toBe(true);
    expect(isValidTimezone('UTC')).toBe(true);
    expect(isValidTimezone('Europe/Nowhere')).toBe(false);
    expect(isValidCurrency('CHF')).toBe(true);
    expect(isValidCurrency('chf')).toBe(false);
    expect(isValidCurrency('XYZ1')).toBe(false);
    expect(isValidContentLocale('de')).toBe(true);
    expect(isValidContentLocale('pt-BR')).toBe(true);
    expect(isValidContentLocale('DE')).toBe(false);
    expect(isValidContentLocale('de_DE')).toBe(false);
  });

  it('rejects contentLocales with duplicates or primary in additional', () => {
    expect(validateWorkspaceSettingValue('contentLocales', '{"primary":"de","additional":["de"]}')).not.toBeNull();
    expect(validateWorkspaceSettingValue('contentLocales', '{"primary":"de","additional":["en","en"]}')).not.toBeNull();
    expect(validateWorkspaceSettingValue('contentLocales', '{"primary":"de","additional":["en"]}')).toBeNull();
    expect(validateWorkspaceSettingValue('contentLocales', null)).toBeNull();
    expect(validateWorkspaceSettingValue('usePrices', 'anything')).toBeNull();
  });

  it('serializes and lists content locales', () => {
    const value = { primary: 'de', additional: ['en'] };
    expect(parseContentLocales(serializeContentLocales(value))).toEqual(value);
    expect(getAllContentLocales(value)).toEqual(['de', 'en']);
    expect(parseContentLocales(null)).toEqual(DEFAULT_CONTENT_LOCALES);
  });

  it('is enforced by the settings update schema', () => {
    expect(WorkspaceSettingUpdateSchema.safeParse({ setting: 'timezone', value: 'Europe/Vienna' }).success).toBe(true);
    expect(WorkspaceSettingUpdateSchema.safeParse({ setting: 'timezone', value: 'Nope/Nope' }).success).toBe(false);
    expect(WorkspaceSettingUpdateSchema.safeParse({ setting: 'currency', value: 'EURO' }).success).toBe(false);
    expect(WorkspaceSettingUpdateSchema.safeParse({ setting: 'currency', value: null }).success).toBe(true);
  });
});
