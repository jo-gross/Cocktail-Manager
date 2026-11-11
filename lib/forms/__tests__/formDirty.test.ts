import { describe, expect, it } from 'vitest';
import { areFormValuesEqual, isFormDirty, normalizeFormValue, trimmed } from '../formDirty';

describe('normalizeFormValue', () => {
  it('treats undefined, null, empty string, NaN and empty collections as "no value"', () => {
    for (const value of [undefined, null, '', Number.NaN, [], {}]) {
      expect(normalizeFormValue(value)).toBeNull();
    }
  });

  it('turns numeric strings from number inputs into numbers', () => {
    expect(normalizeFormValue('12')).toBe(12);
    expect(normalizeFormValue('12.50')).toBe(12.5);
    expect(normalizeFormValue(' -3 ')).toBe(-3);
    expect(normalizeFormValue('12 cl')).toBe('12 cl');
  });

  it('drops keys without a value and sorts keys', () => {
    expect(normalizeFormValue({ b: 1, a: '', c: undefined, d: { e: null } })).toEqual({ b: 1 });
  });

  it('does not trim text', () => {
    expect(normalizeFormValue(' Gin ')).toBe(' Gin ');
  });

  it('compares dates by timestamp', () => {
    expect(normalizeFormValue(new Date('2026-01-02T00:00:00.000Z'))).toBe('2026-01-02T00:00:00.000Z');
  });
});

describe('isFormDirty', () => {
  it('is false for equal values', () => {
    expect(isFormDirty({ name: 'Negroni', tags: ['bitter'] }, { name: 'Negroni', tags: ['bitter'] })).toBe(false);
  });

  it('treats optional values consistently (undefined / null / "")', () => {
    expect(isFormDirty({ description: '', price: null, notes: undefined }, { description: null, price: undefined })).toBe(false);
    expect(isFormDirty({ tags: [] }, { tags: undefined })).toBe(false);
  });

  it('treats numbers typed as strings as equal to the stored number', () => {
    expect(isFormDirty({ price: '9.5', amount: '' }, { price: 9.5, amount: null })).toBe(false);
    expect(isFormDirty({ price: '9.6' }, { price: 9.5 })).toBe(true);
  });

  it('detects real changes deep in arrays', () => {
    const baseline = { steps: [{ actionId: 'shake', ingredients: [{ ingredientId: 'gin', amount: 4 }] }] };
    expect(isFormDirty({ steps: [{ actionId: 'shake', ingredients: [{ ingredientId: 'gin', amount: 5 }] }] }, baseline)).toBe(true);
    expect(isFormDirty({ steps: [] }, baseline)).toBe(true);
  });

  it('is order sensitive for arrays', () => {
    expect(isFormDirty({ steps: ['a', 'b'] }, { steps: ['b', 'a'] })).toBe(true);
  });

  it('ignores fields the comparable mapping leaves out (e.g. display objects enriched after load)', () => {
    const toComparable = (values: { ingredientId: string; ingredient?: object }) => ({ ingredientId: values.ingredientId });
    const initial = { ingredientId: 'gin', ingredient: { id: 'gin', name: 'Gin' } };
    const enriched = { ingredientId: 'gin', ingredient: { id: 'gin', name: 'Gin', price: 20, volumes: [{ unit: 'cl', volume: 70 }] } };
    expect(isFormDirty(enriched, initial)).toBe(true);
    expect(isFormDirty(toComparable(enriched), toComparable(initial))).toBe(false);
  });

  it('areFormValuesEqual is the inverse', () => {
    expect(areFormValuesEqual({ a: 1 }, { a: '1' })).toBe(true);
    expect(areFormValuesEqual({ a: 1 }, { a: 2 })).toBe(false);
  });
});

describe('trimmed', () => {
  it('trims and maps missing values to an empty string', () => {
    expect(trimmed('  Sour ')).toBe('Sour');
    expect(trimmed(null)).toBe('');
    expect(trimmed(undefined)).toBe('');
  });
});
