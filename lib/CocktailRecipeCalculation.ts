import { IngredientModel } from '../models/IngredientModel';

/**
 * Ingredient volume info for unit conversion
 */
export interface IngredientVolumeInfo {
  unitId: string;
  unitName: string;
  volume: number;
}

/**
 * Amount with unit info for aggregation
 */
export interface AmountWithUnit {
  amount: number;
  unitId: string;
  unitName: string;
}

/**
 * Convert an amount to the base unit using the volume factor
 * Formula: baseAmount = amount / volume
 */
export function convertToBaseUnit(amount: number, volume: number): number {
  if (volume === 0) return 0;
  return amount / volume;
}

/**
 * Convert a base unit amount to a target unit using the volume factor
 * Formula: targetAmount = baseAmount * volume
 */
export function convertFromBaseUnit(baseAmount: number, volume: number): number {
  return baseAmount * volume;
}

/**
 * Calculate the total amount of an ingredient in the target unit
 * by converting all amounts to base unit first, then to target unit
 */
export function calculateAggregatedIngredientAmount(
  amounts: AmountWithUnit[],
  availableUnits: IngredientVolumeInfo[],
  targetUnitId: string | undefined,
): { amount: number; unitId: string; unitName: string } {
  if (amounts.length === 0) {
    return { amount: 0, unitId: '', unitName: '' };
  }

  // If no target unit, return first unit with sum (not converted)
  if (!targetUnitId) {
    const firstAmount = amounts[0];
    return {
      amount: amounts.reduce((sum, a) => sum + a.amount, 0),
      unitId: firstAmount.unitId,
      unitName: firstAmount.unitName,
    };
  }

  const targetVolume = availableUnits.find((u) => u.unitId === targetUnitId);
  if (!targetVolume) {
    // Target unit not found in available units, return raw sum
    const firstAmount = amounts[0];
    return {
      amount: amounts.reduce((sum, a) => sum + a.amount, 0),
      unitId: firstAmount.unitId,
      unitName: firstAmount.unitName,
    };
  }

  // Convert all amounts to base unit, then sum
  let totalInBaseUnit = 0;
  amounts.forEach((amountData) => {
    const sourceVolume = availableUnits.find((u) => u.unitId === amountData.unitId);
    if (sourceVolume && sourceVolume.volume > 0) {
      totalInBaseUnit += convertToBaseUnit(amountData.amount, sourceVolume.volume);
    } else {
      // No volume info for source unit - skip or use raw amount
      // Using 0 to avoid incorrect aggregation
      console.warn(`No volume info for unit ${amountData.unitId} (${amountData.unitName})`);
    }
  });

  // Convert from base unit to target unit
  const convertedAmount = convertFromBaseUnit(totalInBaseUnit, targetVolume.volume);

  return {
    amount: convertedAmount,
    unitId: targetVolume.unitId,
    unitName: targetVolume.unitName,
  };
}

/**
 * Minimal cocktail shape needed to compute the material price. Deliberately structural so all three
 * callers satisfy it: the v1 `CocktailDto` (detail modal), the Prisma `CocktailRecipeFull` (calc page)
 * and the edit-form Formik values. Prisma exposes the FK ids (`ingredientId`/`unitId`) while the DTO
 * exposes nested `{ id }` refs — both are resolved below.
 */
interface PriceCalcStepIngredient {
  amount: number | null;
  ingredientId?: string | null;
  unitId?: string | null;
  ingredient?: { id: string } | null;
  unit?: { id: string } | null;
}

interface PriceCalcGarnish {
  isAlternative?: boolean | null;
  garnishId?: string;
  garnish?: { id?: string; price?: number | null } | null;
}

export interface PriceCalcCocktail {
  steps: { ingredients: PriceCalcStepIngredient[] }[];
  garnishes: PriceCalcGarnish[];
}

export function calcCocktailTotalPrice(cocktail: PriceCalcCocktail, ingredients: IngredientModel[]): number {
  const resolveIngredientId = (stepIngredient: PriceCalcStepIngredient) => stepIngredient.ingredientId ?? stepIngredient.ingredient?.id;
  const resolveUnitId = (stepIngredient: PriceCalcStepIngredient) => stepIngredient.unitId ?? stepIngredient.unit?.id;

  return cocktail.steps.filter((step) => step.ingredients.some((ingredient) => ingredient.ingredient != undefined)).length > 0
    ? cocktail.steps
        .map((step) => step.ingredients.filter((ingredient) => ingredient.ingredient != undefined))
        .flat()
        .map((stepIngredient) => {
          const ingredientModel = ingredients.find((ingredient) => ingredient.id == resolveIngredientId(stepIngredient));
          const volume = ingredientModel?.volumes.find((volumeUnits) => volumeUnits.unit.id == resolveUnitId(stepIngredient))?.volume;
          if (volume == undefined) {
            return 0;
          } else {
            // Ingredient price is sourced from the `ingredients` list — the v1 DTO ingredient ref carries
            // no price. For the Prisma/form callers this is identical to the former embedded price, since
            // they pass the same fetchIngredients() list (verify manually after the migration).
            return ((ingredientModel?.price ?? 0) / volume) * (stepIngredient.amount ?? 0);
          }
        })
        .reduce((summ, sum) => summ + sum, 0) +
        cocktail.garnishes
          .filter((garnish) => garnish.garnish != undefined && !garnish.isAlternative)
          .flat()
          .map((garnish) => garnish.garnish?.price ?? 0)
          .reduce((summ, sum) => summ + sum, 0)
    : 0;
}
