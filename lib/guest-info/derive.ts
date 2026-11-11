/**
 * Pure derivation of guest information (allergens, additives, alcohol content)
 * for a cocktail from its ingredients, garnishes and steps.
 * See docs/GUEST-MENU-CONCEPT.md, section "Gästeinformationen".
 */
import {
  ADDITIVES,
  ALCOHOL_FREE_MAX_ABV,
  ALLERGEN_SOURCE_PARENT,
  ALLERGEN_SOURCES,
  ALLERGENS,
  ETHANOL_DENSITY_G_PER_ML,
  getAlcoholCategory,
  getDefaultDilutionPercent,
  type Additive,
  type AlcoholCategory,
  type AlcoholStatus,
  type Allergen,
  type AllergenSource,
} from './constants';

export interface GuestInfoIngredientInput {
  id: string;
  abv: number | null;
  allergens: Allergen[];
  /** Specific cereals/nuts behind GLUTEN/NUTS. */
  allergenSources?: AllergenSource[];
  additives: Additive[];
  guestInfoComplete: boolean;
}

export interface GuestInfoStepInput {
  actionName: string;
  actionGroup: string;
  dilutionPercent: number | null;
  optional: boolean;
  ingredients: {
    amount: number | null;
    unitId: string | null;
    unitName: string | null;
    optional: boolean;
    ingredient: GuestInfoIngredientInput | null;
  }[];
}

export interface GuestInfoGarnishInput {
  optional: boolean;
  isAlternative: boolean;
  garnish: { allergens: Allergen[]; allergenSources?: AllergenSource[]; additives: Additive[]; guestInfoComplete: boolean };
}

export interface GuestInfoCocktailInput {
  abvOverride: number | null;
  extraAllergens: Allergen[];
  extraAdditives: Additive[];
  steps: GuestInfoStepInput[];
  garnishes: GuestInfoGarnishInput[];
}

/** ml per 1 unit, `null` if unknown. */
export interface UnitToMlResolver {
  (unitId: string | null, unitName: string | null, ingredientId: string | null): number | null;
}

export interface DerivedGuestInfo {
  /** `sources`: the specified cereals/nuts of all contributing ingredients/garnishes (legal order). */
  allergens: { code: Allergen; optional: boolean; sources: AllergenSource[] }[];
  additives: { code: Additive; optional: boolean }[];
  complete: boolean;
  alcohol: {
    abv: number | null;
    status: AlcoholStatus;
    category: AlcoholCategory | null;
    alcoholFree: boolean;
    grams: number | null;
    volumeMl: number | null;
  };
}

/** Known base units (by upper-cased name) and their size in ml. */
const BASE_UNITS_ML: Record<string, number> = {
  ML: 1,
  CL: 10,
  DL: 100,
  L: 1000,
};

/**
 * Builds a resolver that converts a workspace unit to ml. Base units are found
 * by name (ML/CL/DL/L, case-insensitive); other units are resolved through the
 * workspace unit conversions (direct or transitive). A conversion means
 * `1 fromUnit = factor × toUnit`.
 */
export function createUnitToMlResolver(
  units: { id: string; name: string }[],
  conversions: { fromUnitId: string; toUnitId: string; factor: number }[],
): UnitToMlResolver {
  const mlPerUnit = new Map<string, number>();
  const queue: string[] = [];
  for (const unit of units) {
    const base = BASE_UNITS_ML[unit.name.trim().toUpperCase()];
    if (base !== undefined) {
      mlPerUnit.set(unit.id, base);
      queue.push(unit.id);
    }
  }

  const edges = new Map<string, { to: string; mlFactor: number }[]>();
  const addEdge = (from: string, to: string, mlFactor: number) => {
    if (!Number.isFinite(mlFactor) || mlFactor <= 0) return;
    const list = edges.get(from) ?? [];
    list.push({ to, mlFactor });
    edges.set(from, list);
  };
  for (const c of conversions) {
    if (!(c.factor > 0)) continue;
    // ml(to) = ml(from) / factor, ml(from) = ml(to) * factor
    addEdge(c.fromUnitId, c.toUnitId, 1 / c.factor);
    addEdge(c.toUnitId, c.fromUnitId, c.factor);
  }

  // Breadth-first: shortest conversion chain wins.
  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentMl = mlPerUnit.get(current)!;
    for (const edge of edges.get(current) ?? []) {
      if (mlPerUnit.has(edge.to)) continue;
      mlPerUnit.set(edge.to, currentMl * edge.mlFactor);
      queue.push(edge.to);
    }
  }

  const idByName = new Map(units.map((u) => [u.name.trim().toUpperCase(), u.id]));

  return (unitId, unitName) => {
    if (unitId && mlPerUnit.has(unitId)) return mlPerUnit.get(unitId)!;
    if (unitName) {
      const upper = unitName.trim().toUpperCase();
      const id = idByName.get(upper);
      if (id && mlPerUnit.has(id)) return mlPerUnit.get(id)!;
      if (BASE_UNITS_ML[upper] !== undefined) return BASE_UNITS_ML[upper];
    }
    return null;
  };
}

function round(value: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

function collect<T extends string>(order: readonly T[], entries: Iterable<{ code: T; optional: boolean }>): { code: T; optional: boolean }[] {
  // A code is only optional if every occurrence is optional.
  const map = new Map<T, boolean>();
  for (const { code, optional } of entries) {
    map.set(code, (map.get(code) ?? true) && optional);
  }
  return order.filter((code) => map.has(code)).map((code) => ({ code, optional: map.get(code)! }));
}

export function deriveCocktailGuestInfo(cocktail: GuestInfoCocktailInput, toMl: UnitToMlResolver): DerivedGuestInfo {
  const allergenEntries: { code: Allergen; optional: boolean }[] = [];
  const additiveEntries: { code: Additive; optional: boolean }[] = [];
  const allergenSources = new Set<AllergenSource>();
  const addSources = (allergens: Allergen[], sources: AllergenSource[] | undefined) =>
    sources?.forEach((source) => {
      if (allergens.includes(ALLERGEN_SOURCE_PARENT[source])) allergenSources.add(source);
    });
  let complete = true;

  for (const code of cocktail.extraAllergens) allergenEntries.push({ code, optional: false });
  for (const code of cocktail.extraAdditives) additiveEntries.push({ code, optional: false });

  let totalMl = 0;
  let alcoholMl = 0;
  let alcoholUnknown = false;
  let maxDilution: number | null = null;

  for (const step of cocktail.steps) {
    // Optional steps (e.g. an optional float) don't change how the drink is diluted.
    if (!step.optional) {
      maxDilution = Math.max(maxDilution ?? 0, step.dilutionPercent ?? getDefaultDilutionPercent(step.actionName));
    }
    for (const item of step.ingredients) {
      const ingredient = item.ingredient;
      if (!ingredient) continue;
      const optional = step.optional || item.optional;

      if (!ingredient.guestInfoComplete) complete = false;
      for (const code of ingredient.allergens) allergenEntries.push({ code, optional });
      addSources(ingredient.allergens, ingredient.allergenSources);
      for (const code of ingredient.additives) additiveEntries.push({ code, optional });

      // Optional ingredients are not part of the standard serving.
      if (optional) continue;
      const mlPerUnit = item.amount != null ? toMl(item.unitId, item.unitName, ingredient.id) : null;
      if (item.amount == null || mlPerUnit == null || ingredient.abv == null) {
        alcoholUnknown = true;
        continue;
      }
      const ml = item.amount * mlPerUnit;
      totalMl += ml;
      alcoholMl += (ml * ingredient.abv) / 100;
    }
  }

  for (const entry of cocktail.garnishes) {
    const optional = entry.optional || entry.isAlternative;
    if (!entry.garnish.guestInfoComplete) complete = false;
    for (const code of entry.garnish.allergens) allergenEntries.push({ code, optional });
    addSources(entry.garnish.allergens, entry.garnish.allergenSources);
    for (const code of entry.garnish.additives) additiveEntries.push({ code, optional });
  }

  const dilutionFactor = 1 + (maxDilution ?? 0) / 100;
  const finalVolume = totalMl * dilutionFactor;

  let alcohol: DerivedGuestInfo['alcohol'];
  if (cocktail.abvOverride != null) {
    const abv = cocktail.abvOverride;
    const volumeMl = alcoholUnknown || totalMl <= 0 ? null : round(finalVolume, 1);
    alcohol = {
      abv,
      status: 'manual',
      category: getAlcoholCategory(abv),
      alcoholFree: abv <= ALCOHOL_FREE_MAX_ABV,
      grams: volumeMl != null ? round(((volumeMl * abv) / 100) * ETHANOL_DENSITY_G_PER_ML, 1) : null,
      volumeMl,
    };
  } else if (alcoholUnknown || totalMl <= 0) {
    // Without any measured liquid there is nothing to vouch for (never claim "alcohol-free").
    alcohol = { abv: null, status: 'unknown', category: null, alcoholFree: false, grams: null, volumeMl: null };
  } else {
    const abv = round((alcoholMl / finalVolume) * 100, 1);
    alcohol = {
      abv,
      status: 'calculated',
      category: getAlcoholCategory(abv),
      alcoholFree: abv <= ALCOHOL_FREE_MAX_ABV,
      grams: round(alcoholMl * ETHANOL_DENSITY_G_PER_ML, 1),
      volumeMl: round(finalVolume, 1),
    };
  }

  return {
    allergens: collect(ALLERGENS, allergenEntries).map((entry) => ({
      ...entry,
      sources: ALLERGEN_SOURCES.filter((source) => ALLERGEN_SOURCE_PARENT[source] === entry.code && allergenSources.has(source)),
    })),
    additives: collect(ADDITIVES, additiveEntries),
    complete,
    alcohol,
  };
}
