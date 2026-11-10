import { describe, expect, it } from 'vitest';
import { isCocktailUnavailable } from '../availability';

describe('isCocktailUnavailable', () => {
  const now = new Date('2026-11-10T20:00:00.000Z');

  it('is unavailable only while unavailableUntil lies in the future', () => {
    expect(isCocktailUnavailable('2026-11-11T05:00:00.000Z', now)).toBe(true);
    expect(isCocktailUnavailable(new Date('2026-11-10T19:59:59.000Z'), now)).toBe(false);
    expect(isCocktailUnavailable(null, now)).toBe(false);
    expect(isCocktailUnavailable(undefined, now)).toBe(false);
    expect(isCocktailUnavailable('invalid', now)).toBe(false);
  });
});
