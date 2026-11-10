/**
 * "Heute aus" helpers: a cocktail is unavailable while `unavailableUntil` lies in
 * the future (set to the next bar-day start by PUT .../cocktails/{id}/availability).
 */
export function isCocktailUnavailable(unavailableUntil: Date | string | null | undefined, now: Date = new Date()): boolean {
  if (unavailableUntil == undefined) return false;
  const until = new Date(unavailableUntil).getTime();
  return Number.isFinite(until) && until > now.getTime();
}
