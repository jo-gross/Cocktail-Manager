/**
 * "Heute aus" helpers: a cocktail is unavailable while `unavailableUntil` lies in
 * the future (set to the next bar-day start by PUT .../cocktails/{id}/availability).
 */
export function isCocktailUnavailable(unavailableUntil: Date | string | null | undefined, now: Date = new Date()): boolean {
  if (unavailableUntil == undefined) return false;
  const until = new Date(unavailableUntil).getTime();
  return Number.isFinite(until) && until > now.getTime();
}

/** Window event fired after the availability toggle (detail modal) saved, so cards can update in place. */
export const COCKTAIL_AVAILABILITY_CHANGED_EVENT = 'cocktail-availability-changed';

export interface CocktailAvailabilityChange {
  cocktailId: string;
  unavailableUntil: string | null;
}

export function emitCocktailAvailabilityChanged(change: CocktailAvailabilityChange, target: EventTarget | undefined = globalThis.window): void {
  target?.dispatchEvent(new CustomEvent<CocktailAvailabilityChange>(COCKTAIL_AVAILABILITY_CHANGED_EVENT, { detail: change }));
}

/** Subscribes to availability changes; returns the unsubscribe function. */
export function onCocktailAvailabilityChanged(
  listener: (change: CocktailAvailabilityChange) => void,
  target: EventTarget | undefined = globalThis.window,
): () => void {
  if (!target) return () => {};
  const handler = (event: Event) => listener((event as CustomEvent<CocktailAvailabilityChange>).detail);
  target.addEventListener(COCKTAIL_AVAILABILITY_CHANGED_EVENT, handler);
  return () => target.removeEventListener(COCKTAIL_AVAILABILITY_CHANGED_EVENT, handler);
}
