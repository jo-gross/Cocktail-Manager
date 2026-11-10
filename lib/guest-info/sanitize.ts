/**
 * Lenient parsing of guest-information fields from untrusted JSON (imports).
 * Missing fields yield `undefined` so older exports leave existing values untouched.
 */
import { ADDITIVES, ALLERGENS, type Additive, type Allergen } from './constants';

export function parseAllergens(value: unknown): Allergen[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return ALLERGENS.filter((code) => value.includes(code));
}

export function parseAdditives(value: unknown): Additive[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return ADDITIVES.filter((code) => value.includes(code));
}

/** ABV / dilution percentage: number within [min, max], `null` if explicitly null, otherwise undefined. */
export function parsePercent(value: unknown, max = 100): number | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max) return undefined;
  return value;
}

export function parseBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

export function parseNullableString(value: unknown): string | null | undefined {
  if (value === null) return null;
  return typeof value === 'string' ? value : undefined;
}

/** Guest-info fields of an exported ingredient, ready for a Prisma create/update. */
export function ingredientGuestInfoImportData(entity: object) {
  const data = entity as Record<string, unknown>;
  return {
    abv: parsePercent(data.abv),
    allergens: parseAllergens(data.allergens),
    additives: parseAdditives(data.additives),
    guestInfoComplete: parseBoolean(data.guestInfoComplete),
    hideOnGuestMenu: parseBoolean(data.hideOnGuestMenu),
    guestName: parseNullableString(data.guestName),
  };
}

/** Guest-info fields of an exported garnish, ready for a Prisma create/update. */
export function garnishGuestInfoImportData(entity: object) {
  const data = entity as Record<string, unknown>;
  return {
    allergens: parseAllergens(data.allergens),
    additives: parseAdditives(data.additives),
    guestInfoComplete: parseBoolean(data.guestInfoComplete),
  };
}

/** Guest-info fields of an exported cocktail recipe, ready for a Prisma create/update. */
export function cocktailGuestInfoImportData(entity: object) {
  const data = entity as Record<string, unknown>;
  return {
    abvOverride: parsePercent(data.abvOverride),
    extraAllergens: parseAllergens(data.extraAllergens),
    extraAdditives: parseAdditives(data.extraAdditives),
  };
}
