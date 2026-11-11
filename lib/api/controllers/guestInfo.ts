/**
 * Business logic for guest information (allergens, additives, alcohol content):
 * derived info per cocktail, the data-maintenance overview and bulk inline editing.
 */
import prisma from '../../../prisma/prisma';
import { createLog } from '@lib/auditLog';
import { ApiError } from '@lib/http/ApiError';
import { deriveCocktailGuestInfo } from '@lib/guest-info/derive';
import { nextAllergenSources } from '@lib/guest-info/constants';
import { guestInfoCocktailSelect, loadCocktailGuestInfo, loadUnitToMlResolver, toGuestInfoCocktailInput } from '@lib/guest-info/loadCocktailGuestInfo.server';
import type { User, Workspace } from '@generated/prisma/client';
import type { CocktailGuestInfoResponse, GuestInfoBulkUpdateInput, GuestInfoOverview } from '@lib/schemas/guestInfo';

type Sources = CocktailGuestInfoResponse['sources'];

export async function getCocktailGuestInfo(workspace: Workspace, cocktailId: string): Promise<CocktailGuestInfoResponse> {
  const [toMl, cocktail] = await Promise.all([
    loadUnitToMlResolver(workspace.id),
    prisma.cocktailRecipe.findFirst({ where: { id: cocktailId, workspaceId: workspace.id }, select: guestInfoCocktailSelect }),
  ]);
  if (!cocktail) throw new ApiError(404, 'NOT_FOUND', 'Cocktail not found');

  const input = toGuestInfoCocktailInput(cocktail);
  const derived = deriveCocktailGuestInfo(input, toMl);

  const sources: Sources = { allergens: [], additives: [], incomplete: [], missingAbv: [] };
  const cocktailRef = { type: 'cocktail' as const, id: cocktail.id, name: cocktail.name, optional: false };
  for (const code of cocktail.extraAllergens) sources.allergens.push({ ...cocktailRef, code });
  for (const code of cocktail.extraAdditives) sources.additives.push({ ...cocktailRef, code });

  const seenIncomplete = new Set<string>();
  const seenMissingAbv = new Set<string>();
  cocktail.steps.forEach((step) => {
    for (const item of step.ingredients) {
      const ingredient = item.ingredient;
      if (!ingredient) continue;
      const ref = { type: 'ingredient' as const, id: ingredient.id, name: ingredient.name, optional: step.optional || item.optional };
      for (const code of ingredient.allergens) sources.allergens.push({ ...ref, code });
      for (const code of ingredient.additives) sources.additives.push({ ...ref, code });
      if (!ingredient.guestInfoComplete && !seenIncomplete.has(ingredient.id)) {
        seenIncomplete.add(ingredient.id);
        sources.incomplete.push({ type: 'ingredient', id: ingredient.id, name: ingredient.name });
      }
      if (!ref.optional && !seenMissingAbv.has(ingredient.id)) {
        const ml = item.amount != null ? toMl(item.unitId, item.unit?.name ?? null, ingredient.id) : null;
        if (ingredient.abv == null || ml == null) {
          seenMissingAbv.add(ingredient.id);
          sources.missingAbv.push({ type: 'ingredient', id: ingredient.id, name: ingredient.name });
        }
      }
    }
  });
  for (const entry of cocktail.garnishes) {
    const garnish = entry.garnish;
    const ref = { type: 'garnish' as const, id: garnish.id, name: garnish.name, optional: Boolean(entry.optional || entry.isAlternative) };
    for (const code of garnish.allergens) sources.allergens.push({ ...ref, code });
    for (const code of garnish.additives) sources.additives.push({ ...ref, code });
    if (!garnish.guestInfoComplete && !seenIncomplete.has(garnish.id)) {
      seenIncomplete.add(garnish.id);
      sources.incomplete.push({ type: 'garnish', id: garnish.id, name: garnish.name });
    }
  }

  return { ...derived, sources };
}

export async function getGuestInfoOverview(workspace: Workspace): Promise<GuestInfoOverview> {
  const [ingredients, garnishes, derived] = await Promise.all([
    prisma.ingredient.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        abv: true,
        allergens: true,
        allergenSources: true,
        additives: true,
        guestInfoComplete: true,
        hideOnGuestMenu: true,
        guestName: true,
        CocktailRecipeIngredient: { select: { cocktailRecipeStep: { select: { cocktailRecipeId: true } } } },
      },
    }),
    prisma.garnish.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        allergens: true,
        allergenSources: true,
        additives: true,
        guestInfoComplete: true,
        _count: { select: { CocktailRecipeGarnishes: true } },
      },
    }),
    loadCocktailGuestInfo(workspace.id),
  ]);

  const cocktailInfos = Array.from(derived.values());
  return {
    ingredients: ingredients.map(({ CocktailRecipeIngredient, ...ingredient }) => ({
      ...ingredient,
      usedInCocktails: new Set(CocktailRecipeIngredient.map((r) => r.cocktailRecipeStep.cocktailRecipeId)).size,
    })),
    garnishes: garnishes.map(({ _count, ...garnish }) => ({ ...garnish, usedInCocktails: _count.CocktailRecipeGarnishes })),
    stats: {
      ingredients: {
        total: ingredients.length,
        complete: ingredients.filter((i) => i.guestInfoComplete).length,
        withAbv: ingredients.filter((i) => i.abv != null).length,
      },
      garnishes: { total: garnishes.length, complete: garnishes.filter((g) => g.guestInfoComplete).length },
      cocktails: {
        total: cocktailInfos.length,
        complete: cocktailInfos.filter((c) => c.complete).length,
        abvKnown: cocktailInfos.filter((c) => c.alcohol.status !== 'unknown').length,
      },
    },
  };
}

export async function bulkUpdateGuestInfo(
  workspace: Workspace,
  user: User,
  input: GuestInfoBulkUpdateInput,
): Promise<{ ingredients: number; garnishes: number }> {
  const ingredientUpdates = input.ingredients ?? [];
  const garnishUpdates = input.garnishes ?? [];

  return prisma.$transaction(
    async (tx) => {
      let ingredients = 0;
      for (const { id, ...data } of ingredientUpdates) {
        const old = await tx.ingredient.findFirst({ where: { id, workspaceId: workspace.id } });
        if (!old) throw new ApiError(404, 'NOT_FOUND', `Ingredient ${id} not found`);
        const updated = await tx.ingredient.update({
          where: { id },
          data: {
            abv: data.abv,
            allergens: data.allergens,
            allergenSources: nextAllergenSources(data, old),
            additives: data.additives,
            guestInfoComplete: data.guestInfoComplete,
            hideOnGuestMenu: data.hideOnGuestMenu,
            guestName: data.guestName === undefined ? undefined : data.guestName?.trim() || null,
          },
        });
        await createLog(tx, workspace.id, user.id, 'Ingredient', id, 'UPDATE', old, updated);
        ingredients++;
      }

      let garnishes = 0;
      for (const { id, ...data } of garnishUpdates) {
        const old = await tx.garnish.findFirst({ where: { id, workspaceId: workspace.id } });
        if (!old) throw new ApiError(404, 'NOT_FOUND', `Garnish ${id} not found`);
        const updated = await tx.garnish.update({
          where: { id },
          data: {
            allergens: data.allergens,
            allergenSources: nextAllergenSources(data, old),
            additives: data.additives,
            guestInfoComplete: data.guestInfoComplete,
          },
        });
        await createLog(tx, workspace.id, user.id, 'Garnish', id, 'UPDATE', old, updated);
        garnishes++;
      }

      return { ingredients, garnishes };
    },
    { timeout: 30_000 },
  );
}
