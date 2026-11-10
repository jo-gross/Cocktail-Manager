/**
 * Shared guest-information constants (allergens, additives, alcohol categories).
 * Pure module: runtime lists mirror the Prisma enums and are type-checked
 * against them, so this file can be used on the client without the Prisma runtime.
 * Labels live in the `guestInfo` i18n namespace (`guestInfo:allergen.<CODE>` etc.).
 */
import type { Additive, Allergen } from '@generated/prisma/client';

export type { Additive, Allergen };

/** The 14 allergens of Regulation (EU) No 1169/2011, Annex II, in legal order. */
export const ALLERGENS = [
  'GLUTEN',
  'CRUSTACEANS',
  'EGGS',
  'FISH',
  'PEANUTS',
  'SOY',
  'MILK',
  'NUTS',
  'CELERY',
  'MUSTARD',
  'SESAME',
  'SULPHITES',
  'LUPIN',
  'MOLLUSCS',
] as const satisfies readonly Allergen[];

/** Labelling-relevant additives (German ZZulV / LMIV practice), in footnote order. */
export const ADDITIVES = [
  'COLORING',
  'PRESERVATIVE',
  'ANTIOXIDANT',
  'FLAVOR_ENHANCER',
  'SULPHURED',
  'BLACKENED',
  'WAXED',
  'PHOSPHATE',
  'SWEETENER',
  'PHENYLALANINE',
  'CAFFEINE',
  'QUININE',
] as const satisfies readonly Additive[];

// Compile-time guard: fails if a Prisma enum value is missing from the lists above.
type MissingAllergen = Exclude<Allergen, (typeof ALLERGENS)[number]>;
type MissingAdditive = Exclude<Additive, (typeof ADDITIVES)[number]>;
const _allergensComplete: MissingAllergen extends never ? true : never = true;
const _additivesComplete: MissingAdditive extends never ? true : never = true;
void _allergensComplete;
void _additivesComplete;

/** Common letter codes for allergen footnotes (A–R, as used in AT/DE gastronomy). */
export const ALLERGEN_CODES: Record<Allergen, string> = {
  GLUTEN: 'A',
  CRUSTACEANS: 'B',
  EGGS: 'C',
  FISH: 'D',
  PEANUTS: 'E',
  SOY: 'F',
  MILK: 'G',
  NUTS: 'H',
  CELERY: 'L',
  MUSTARD: 'M',
  SESAME: 'N',
  SULPHITES: 'O',
  LUPIN: 'P',
  MOLLUSCS: 'R',
};

/** Footnote numbers for additives (1–12). */
export const ADDITIVE_NUMBERS: Record<Additive, number> = {
  COLORING: 1,
  PRESERVATIVE: 2,
  ANTIOXIDANT: 3,
  FLAVOR_ENHANCER: 4,
  SULPHURED: 5,
  BLACKENED: 6,
  WAXED: 7,
  PHOSPHATE: 8,
  SWEETENER: 9,
  PHENYLALANINE: 10,
  CAFFEINE: 11,
  QUININE: 12,
};

export const ALCOHOL_CATEGORIES = ['alcoholFree', 'light', 'medium', 'strong'] as const;
export type AlcoholCategory = (typeof ALCOHOL_CATEGORIES)[number];

/** `calculated` from ingredients, `manual` via CocktailRecipe.abvOverride, `unknown` if any ABV is missing. */
export type AlcoholStatus = 'calculated' | 'manual' | 'unknown';

/** Max ABV (in % vol) that still counts as alcohol-free. */
export const ALCOHOL_FREE_MAX_ABV = 0.5;
/** Upper bound (exclusive) for "light". */
export const ALCOHOL_LIGHT_MAX_ABV = 10;
/** Upper bound (inclusive) for "medium"; above is "strong". */
export const ALCOHOL_MEDIUM_MAX_ABV = 20;

/** Ethanol density in g/ml, used to convert ml of pure alcohol to grams. */
export const ETHANOL_DENSITY_G_PER_ML = 0.789;

/** Spec categories: alkoholfrei ≤0,5 / leicht <10 / mittel ≤20 / stark >20. */
export function getAlcoholCategory(abv: number): AlcoholCategory {
  if (abv <= ALCOHOL_FREE_MAX_ABV) return 'alcoholFree';
  if (abv < ALCOHOL_LIGHT_MAX_ABV) return 'light';
  if (abv <= ALCOHOL_MEDIUM_MAX_ABV) return 'medium';
  return 'strong';
}

/**
 * Default dilution (water from ice, % of the liquid volume) when
 * `WorkspaceCocktailRecipeStepAction.dilutionPercent` is not set. The spec says
 * "per actionGroup", but SHAKE/STIR are action *names* (group `MIXING`) in the
 * default workspace actions, so this is keyed by action name.
 */
export const DEFAULT_DILUTION_PERCENT_BY_ACTION: Record<string, number> = {
  SHAKE: 25,
  STIR: 20,
};
export const DEFAULT_DILUTION_PERCENT = 10;

export function getDefaultDilutionPercent(actionName: string | null | undefined): number {
  if (!actionName) return DEFAULT_DILUTION_PERCENT;
  return DEFAULT_DILUTION_PERCENT_BY_ACTION[actionName.toUpperCase()] ?? DEFAULT_DILUTION_PERCENT;
}
