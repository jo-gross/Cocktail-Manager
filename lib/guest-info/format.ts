/**
 * Display text of guest information, shared by the management UI and the guest menus so an allergen
 * reads the same everywhere: the Annex II designation, plus the specified cereals/nuts in brackets.
 */
import type { Allergen, AllergenSource } from './constants';

/** „Glutenhaltiges Getreide (Weizen, Gerste)“ – `t` resolves `guestInfo:` keys. */
export function formatAllergenLabel(t: (key: string) => string, code: Allergen, sources: readonly AllergenSource[] = []): string {
  const label = t(`guestInfo:allergen.${code}`);
  if (sources.length === 0) return label;
  return `${label} (${sources.map((source) => t(`guestInfo:allergenSource.${source}`)).join(', ')})`;
}
