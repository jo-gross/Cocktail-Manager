/**
 * Prisma loaders for guest information: fetches everything `deriveCocktailGuestInfo`
 * needs for a workspace (units, conversions, cocktails with steps/ingredients/garnishes).
 */
import prisma from '../../prisma/prisma';
import type { Prisma } from '@generated/prisma/client';
import { createUnitToMlResolver, deriveCocktailGuestInfo, type DerivedGuestInfo, type GuestInfoCocktailInput, type UnitToMlResolver } from './derive';

export const guestInfoCocktailSelect = {
  id: true,
  name: true,
  abvOverride: true,
  extraAllergens: true,
  extraAdditives: true,
  steps: {
    orderBy: { stepNumber: 'asc' },
    select: {
      optional: true,
      action: { select: { name: true, actionGroup: true, dilutionPercent: true } },
      ingredients: {
        orderBy: { ingredientNumber: 'asc' },
        select: {
          amount: true,
          optional: true,
          unitId: true,
          unit: { select: { name: true } },
          ingredient: {
            select: { id: true, name: true, abv: true, allergens: true, additives: true, guestInfoComplete: true },
          },
        },
      },
    },
  },
  garnishes: {
    orderBy: { garnishNumber: 'asc' },
    select: {
      optional: true,
      isAlternative: true,
      garnish: { select: { id: true, name: true, allergens: true, additives: true, guestInfoComplete: true } },
    },
  },
} satisfies Prisma.CocktailRecipeSelect;

export type GuestInfoCocktailRow = Prisma.CocktailRecipeGetPayload<{ select: typeof guestInfoCocktailSelect }>;

export function toGuestInfoCocktailInput(row: GuestInfoCocktailRow): GuestInfoCocktailInput {
  return {
    abvOverride: row.abvOverride,
    extraAllergens: row.extraAllergens,
    extraAdditives: row.extraAdditives,
    steps: row.steps.map((step) => ({
      actionName: step.action.name,
      actionGroup: step.action.actionGroup,
      dilutionPercent: step.action.dilutionPercent,
      optional: step.optional,
      ingredients: step.ingredients.map((item) => ({
        amount: item.amount,
        unitId: item.unitId,
        unitName: item.unit?.name ?? null,
        optional: item.optional,
        ingredient: item.ingredient,
      })),
    })),
    garnishes: row.garnishes.map((g) => ({
      optional: g.optional ?? false,
      isAlternative: g.isAlternative ?? false,
      garnish: g.garnish,
    })),
  };
}

/** Unit → ml resolver for a workspace (units by name + workspace conversions). */
export async function loadUnitToMlResolver(workspaceId: string): Promise<UnitToMlResolver> {
  const [units, conversions] = await Promise.all([
    prisma.unit.findMany({ where: { workspaceId }, select: { id: true, name: true } }),
    prisma.unitConversion.findMany({ where: { workspaceId }, select: { fromUnitId: true, toUnitId: true, factor: true } }),
  ]);
  return createUnitToMlResolver(units, conversions);
}

/**
 * Derives guest information for cocktails of a workspace.
 * @param cocktailIds limit to these cocktails (default: all non-archived)
 */
export async function loadCocktailGuestInfo(workspaceId: string, cocktailIds?: string[]): Promise<Map<string, DerivedGuestInfo>> {
  const [toMl, cocktails] = await Promise.all([
    loadUnitToMlResolver(workspaceId),
    prisma.cocktailRecipe.findMany({
      where: cocktailIds ? { workspaceId, id: { in: cocktailIds } } : { workspaceId, isArchived: false },
      select: guestInfoCocktailSelect,
    }),
  ]);
  const result = new Map<string, DerivedGuestInfo>();
  for (const cocktail of cocktails) {
    result.set(cocktail.id, deriveCocktailGuestInfo(toGuestInfoCocktailInput(cocktail), toMl));
  }
  return result;
}
