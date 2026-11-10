import { describe, expect, it } from 'vitest';
import { cocktailGuestInfoImportData, garnishGuestInfoImportData, ingredientGuestInfoImportData, parsePercent } from '../sanitize';

describe('guest-info import sanitizing', () => {
  it('keeps missing fields undefined (older exports)', () => {
    expect(ingredientGuestInfoImportData({ name: 'Gin' })).toEqual({
      abv: undefined,
      allergens: undefined,
      additives: undefined,
      guestInfoComplete: undefined,
      hideOnGuestMenu: undefined,
      guestName: undefined,
    });
  });

  it('filters unknown codes and keeps legal order', () => {
    expect(garnishGuestInfoImportData({ allergens: ['MILK', 'FOO', 'GLUTEN'], additives: ['CAFFEINE'], guestInfoComplete: true })).toEqual({
      allergens: ['GLUTEN', 'MILK'],
      additives: ['CAFFEINE'],
      guestInfoComplete: true,
    });
  });

  it('validates percentages', () => {
    expect(parsePercent(40)).toBe(40);
    expect(parsePercent(null)).toBeNull();
    expect(parsePercent(120)).toBeUndefined();
    expect(parsePercent('40')).toBeUndefined();
    expect(cocktailGuestInfoImportData({ abvOverride: 12.5, extraAllergens: ['EGGS'], extraAdditives: [] })).toEqual({
      abvOverride: 12.5,
      extraAllergens: ['EGGS'],
      extraAdditives: [],
    });
  });
});
