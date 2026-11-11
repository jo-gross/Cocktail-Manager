import { describe, expect, it } from 'vitest';
import { cocktailGuestInfoImportData, garnishGuestInfoImportData, ingredientGuestInfoImportData, parsePercent } from '../sanitize';

describe('guest-info import sanitizing', () => {
  it('keeps missing fields undefined (older exports)', () => {
    expect(ingredientGuestInfoImportData({ name: 'Gin' })).toEqual({
      abv: undefined,
      allergens: undefined,
      allergenSources: undefined,
      additives: undefined,
      guestInfoComplete: undefined,
      hideOnGuestMenu: undefined,
      guestName: undefined,
    });
  });

  it('filters unknown codes and keeps legal order', () => {
    expect(garnishGuestInfoImportData({ allergens: ['MILK', 'FOO', 'GLUTEN'], additives: ['CAFFEINE'], guestInfoComplete: true })).toEqual({
      allergens: ['GLUTEN', 'MILK'],
      allergenSources: [],
      additives: ['CAFFEINE'],
      guestInfoComplete: true,
    });
  });

  it('keeps only cereals/nuts whose allergen is set', () => {
    expect(ingredientGuestInfoImportData({ allergens: ['GLUTEN'], allergenSources: ['OATS', 'WHEAT', 'ALMONDS', 'FOO'] }).allergenSources).toEqual([
      'WHEAT',
      'OATS',
    ]);
    // Without allergens (older export) the sources stay untouched as well.
    expect(garnishGuestInfoImportData({ allergenSources: ['WHEAT'] }).allergenSources).toBeUndefined();
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
