import { describe, expect, it } from 'vitest';
import { allergenSourcesOf, nextAllergenSources, pruneAllergenSources, SPECIFIABLE_ALLERGENS } from '../constants';
import { formatAllergenLabel } from '../format';

describe('allergen sources', () => {
  it('maps the Annex II cereals and nuts to GLUTEN and NUTS', () => {
    expect(SPECIFIABLE_ALLERGENS).toEqual(['GLUTEN', 'NUTS']);
    expect(allergenSourcesOf('GLUTEN')).toEqual(['WHEAT', 'SPELT', 'KHORASAN_WHEAT', 'RYE', 'BARLEY', 'OATS']);
    expect(allergenSourcesOf('MILK')).toEqual([]);
  });

  it('prunes sources without their allergen and orders them', () => {
    expect(pruneAllergenSources(['NUTS'], ['WHEAT', 'WALNUTS', 'ALMONDS', 'WALNUTS'])).toEqual(['ALMONDS', 'WALNUTS']);
  });

  it('recomputes sources on update only when allergens or sources change', () => {
    const existing = { allergens: ['GLUTEN' as const], allergenSources: ['WHEAT' as const] };
    expect(nextAllergenSources({}, existing)).toBeUndefined();
    expect(nextAllergenSources({ allergens: ['GLUTEN', 'MILK'] }, existing)).toEqual(['WHEAT']);
    // Removing GLUTEN drops „Weizen“.
    expect(nextAllergenSources({ allergens: ['MILK'] }, existing)).toEqual([]);
    expect(nextAllergenSources({ allergenSources: ['RYE'] }, existing)).toEqual(['RYE']);
    expect(nextAllergenSources({ allergens: ['GLUTEN'], allergenSources: ['RYE', 'ALMONDS'] })).toEqual(['RYE']);
  });

  it('formats the label with the sources in brackets', () => {
    const t = (key: string) =>
      ({ 'guestInfo:allergen.GLUTEN': 'Glutenhaltiges Getreide', 'guestInfo:allergenSource.WHEAT': 'Weizen', 'guestInfo:allergenSource.BARLEY': 'Gerste' })[
        key
      ] ?? key;
    expect(formatAllergenLabel(t, 'GLUTEN')).toBe('Glutenhaltiges Getreide');
    expect(formatAllergenLabel(t, 'GLUTEN', ['WHEAT', 'BARLEY'])).toBe('Glutenhaltiges Getreide (Weizen, Gerste)');
  });
});
