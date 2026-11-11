import { describe, expect, it, vi } from 'vitest';
import { emitCocktailAvailabilityChanged, isCocktailUnavailable, onCocktailAvailabilityChanged } from '../availability';

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

describe('cocktail availability events', () => {
  it('delivers changes to subscribers until they unsubscribe', () => {
    const target = new EventTarget();
    const listener = vi.fn();
    const unsubscribe = onCocktailAvailabilityChanged(listener, target);

    emitCocktailAvailabilityChanged({ cocktailId: 'c1', unavailableUntil: '2026-11-11T05:00:00.000Z' }, target);
    expect(listener).toHaveBeenCalledWith({ cocktailId: 'c1', unavailableUntil: '2026-11-11T05:00:00.000Z' });

    unsubscribe();
    emitCocktailAvailabilityChanged({ cocktailId: 'c1', unavailableUntil: null }, target);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('is a no-op without a window (SSR)', () => {
    expect(() => emitCocktailAvailabilityChanged({ cocktailId: 'c1', unavailableUntil: null })).not.toThrow();
    expect(onCocktailAvailabilityChanged(vi.fn())).toBeTypeOf('function');
  });
});
