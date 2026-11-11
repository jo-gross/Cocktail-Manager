/**
 * Shared guest-information constants (allergens, additives, alcohol categories).
 * Pure module: runtime lists mirror the Prisma enums and are type-checked
 * against them, so this file can be used on the client without the Prisma runtime.
 * Labels live in the `guestInfo` i18n namespace (`guestInfo:allergen.<CODE>` etc.).
 *
 * Allergens have exactly one designation everywhere (management chips, guest legend, filters):
 * the one of Annex II of Regulation (EU) No 1169/2011 (LMIV), e.g. „Schalenfrüchte“ – not „Nüsse“.
 * Do not add colloquial short forms; that is what the letter codes below are for.
 */
import type { Additive, Allergen, AllergenSource } from '@generated/prisma/client';

export type { Additive, Allergen, AllergenSource };

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

/**
 * The cereals and nuts Annex II names for GLUTEN („namentlich Weizen (wie Dinkel und Khorasan-Weizen),
 * Roggen, Gerste, Hafer“) and NUTS („namentlich Mandeln, Haselnüsse, …“), in legal order.
 * Optional detail on ingredients/garnishes, shown in brackets: „Glutenhaltiges Getreide (Weizen)“.
 */
export const ALLERGEN_SOURCES = [
  'WHEAT',
  'SPELT',
  'KHORASAN_WHEAT',
  'RYE',
  'BARLEY',
  'OATS',
  'ALMONDS',
  'HAZELNUTS',
  'WALNUTS',
  'CASHEWS',
  'PECANS',
  'BRAZIL_NUTS',
  'PISTACHIOS',
  'MACADAMIA_NUTS',
] as const satisfies readonly AllergenSource[];

/** The allergen a source belongs to. */
export const ALLERGEN_SOURCE_PARENT: Record<AllergenSource, Allergen> = {
  WHEAT: 'GLUTEN',
  SPELT: 'GLUTEN',
  KHORASAN_WHEAT: 'GLUTEN',
  RYE: 'GLUTEN',
  BARLEY: 'GLUTEN',
  OATS: 'GLUTEN',
  ALMONDS: 'NUTS',
  HAZELNUTS: 'NUTS',
  WALNUTS: 'NUTS',
  CASHEWS: 'NUTS',
  PECANS: 'NUTS',
  BRAZIL_NUTS: 'NUTS',
  PISTACHIOS: 'NUTS',
  MACADAMIA_NUTS: 'NUTS',
};

/** Sources of `allergen`, in legal order. */
export function allergenSourcesOf(allergen: Allergen): AllergenSource[] {
  return ALLERGEN_SOURCES.filter((source) => ALLERGEN_SOURCE_PARENT[source] === allergen);
}

/** Allergens that can be specified further (GLUTEN, NUTS). */
export const SPECIFIABLE_ALLERGENS: Allergen[] = ALLERGENS.filter((allergen) => allergenSourcesOf(allergen).length > 0);

/** Keeps only known sources whose allergen is selected, deduplicated and in legal order. */
export function pruneAllergenSources(allergens: readonly Allergen[], sources: readonly AllergenSource[]): AllergenSource[] {
  return ALLERGEN_SOURCES.filter((source) => sources.includes(source) && allergens.includes(ALLERGEN_SOURCE_PARENT[source]));
}

/**
 * Sources to store for an update: recomputed when the allergens or the sources change (so removing GLUTEN
 * also drops „Weizen“), `undefined` = leave untouched.
 */
export function nextAllergenSources(
  input: { allergens?: Allergen[]; allergenSources?: AllergenSource[] },
  existing?: { allergens: Allergen[]; allergenSources: AllergenSource[] } | null,
): AllergenSource[] | undefined {
  if (input.allergens === undefined && input.allergenSources === undefined) return undefined;
  return pruneAllergenSources(input.allergens ?? existing?.allergens ?? [], input.allergenSources ?? existing?.allergenSources ?? []);
}

// Compile-time guard: fails if a Prisma enum value is missing from the lists above.
type MissingAllergen = Exclude<Allergen, (typeof ALLERGENS)[number]>;
type MissingAdditive = Exclude<Additive, (typeof ADDITIVES)[number]>;
type MissingAllergenSource = Exclude<AllergenSource, (typeof ALLERGEN_SOURCES)[number]>;
const _allergensComplete: MissingAllergen extends never ? true : never = true;
const _additivesComplete: MissingAdditive extends never ? true : never = true;
const _allergenSourcesComplete: MissingAllergenSource extends never ? true : never = true;
void _allergensComplete;
void _additivesComplete;
void _allergenSourcesComplete;

/** Letter codes for allergen footnotes (A–R) of the Austrian Allergeninformationsverordnung (BGBl. II 175/2014), also common in DE. */
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
