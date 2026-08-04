/**
 * Prisma → public DTO mapping for calculations (cocktail calculations + groups).
 * Keeps the /api/v1 contract clean: nested cocktail relations collapse to a slim
 * `cocktail: { id, name }` ref, the group's `_count.calculations` becomes a plain
 * `calculationCount`, dates serialize to ISO strings and `workspaceId` is dropped
 * (implied by the path).
 */
import type {
  CocktailCalculation,
  CocktailCalculationGroup,
  CocktailCalculationItems,
  CalculationIngredientShoppingUnit,
  CocktailRecipe,
  Ingredient,
  Unit,
} from '@generated/prisma/client';
import type {
  CalculationDto,
  CalculationGroupDto,
  CalculationGroupRef,
  CalculationItemDto,
  CalculationShoppingUnitDto,
  CalculationSummaryDto,
} from '@lib/schemas/calculations';

type ItemWithCocktail = Pick<CocktailCalculationItems, 'plannedAmount' | 'customPrice'> & {
  cocktail: Pick<CocktailRecipe, 'id' | 'name'>;
};

type ShoppingUnitWithRefs = Pick<CalculationIngredientShoppingUnit, 'checked'> & {
  ingredient: Pick<Ingredient, 'id' | 'name'>;
  unit: Pick<Unit, 'id' | 'name'>;
};

type CalculationSummarySource = Pick<CocktailCalculation, 'id' | 'name' | 'showSalesStuff' | 'updatedAt'> & {
  group: Pick<CocktailCalculationGroup, 'id' | 'name' | 'isDefaultExpanded'> | null;
  cocktailCalculationItems: ItemWithCocktail[];
};

type CalculationSource = CalculationSummarySource & {
  ingredientShoppingUnits: ShoppingUnitWithRefs[];
};

function toGroupRef(group: Pick<CocktailCalculationGroup, 'id' | 'name' | 'isDefaultExpanded'> | null): CalculationGroupRef | null {
  return group ? { id: group.id, name: group.name, isDefaultExpanded: group.isDefaultExpanded } : null;
}

function toItemDto(item: ItemWithCocktail): CalculationItemDto {
  return {
    cocktail: { id: item.cocktail.id, name: item.cocktail.name },
    plannedAmount: item.plannedAmount,
    customPrice: item.customPrice,
  };
}

function toShoppingUnitDto(unit: ShoppingUnitWithRefs): CalculationShoppingUnitDto {
  return {
    ingredient: { id: unit.ingredient.id, name: unit.ingredient.name },
    unit: { id: unit.unit.id, name: unit.unit.name },
    checked: unit.checked,
  };
}

/** Slim summary for list views — group ref + slim items, no ingredient shopping units. */
export function toCalculationSummaryDto(calculation: CalculationSummarySource): CalculationSummaryDto {
  return {
    id: calculation.id,
    name: calculation.name,
    showSalesStuff: calculation.showSalesStuff,
    updatedAt: calculation.updatedAt.toISOString(),
    group: toGroupRef(calculation.group),
    items: calculation.cocktailCalculationItems.map(toItemDto),
  };
}

/** Full calculation with ingredient shopping units. */
export function toCalculationDto(calculation: CalculationSource): CalculationDto {
  return {
    ...toCalculationSummaryDto(calculation),
    ingredientShoppingUnits: calculation.ingredientShoppingUnits.map(toShoppingUnitDto),
  };
}

/** Group with a plain `calculationCount` instead of `_count.calculations`. */
export function toCalculationGroupDto(
  group: Pick<CocktailCalculationGroup, 'id' | 'name' | 'isDefaultExpanded'> & { _count: { calculations: number } },
): CalculationGroupDto {
  return {
    id: group.id,
    name: group.name,
    isDefaultExpanded: group.isDefaultExpanded,
    calculationCount: group._count.calculations,
  };
}
