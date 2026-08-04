/**
 * Version-agnostic business logic for cocktails (v1). Faithfully replicates the
 * DB operations of the legacy handlers (including the differential PUT of
 * steps/ingredients/garnishes and the cascade DELETE), but returns clean public
 * DTOs (lib/api/dto/cocktails.ts). Legacy routes remain wrapped-but-untouched.
 */
import prisma from '../../../prisma/prisma';
import { createCocktailRecipeAuditLog } from '@lib/auditLog';
import { calculateCocktailRecipeSimilarity } from '@lib/findSimilarEntities';
import { normalizeString } from '@lib/StringUtils';
import { ApiError } from '@lib/http/ApiError';
import { toCocktailDto, toCocktailSummaryDto } from '@lib/api/dto/cocktails';
import type { Prisma, User, Workspace } from '@generated/prisma/client';
import type { CocktailCreateInput, CocktailDto, CocktailSummaryDto, CocktailUpdateInput } from '@lib/schemas/cocktails';

/** Full include used for the detail DTO (with nested image counts + rating aggregates). */
const fullInclude = {
  _count: { select: { CocktailRecipeImage: true } },
  ice: true,
  glass: { include: { _count: { select: { GlassImage: true } } } },
  garnishes: {
    include: {
      garnish: { include: { _count: { select: { GarnishImage: true } } } },
    },
  },
  steps: {
    include: {
      action: true,
      ingredients: {
        include: {
          ingredient: { include: { _count: { select: { IngredientImage: true } } } },
          unit: true,
        },
      },
    },
  },
  ratings: { select: { rating: true } },
} satisfies Prisma.CocktailRecipeInclude;

/** Include used by the auditlog snapshots (mirrors the legacy handlers). */
const auditInclude = {
  ice: true,
  glass: { include: { _count: { select: { GlassImage: true } } } },
  garnishes: { include: { garnish: true } },
  steps: { include: { action: true, ingredients: { include: { ingredient: true, unit: true } } } },
  CocktailRecipeImage: true,
} satisfies Prisma.CocktailRecipeInclude;

/** Slim include for list/summary views. */
const summaryInclude = {
  _count: { select: { CocktailRecipeImage: true } },
  glass: { include: { _count: { select: { GlassImage: true } } } },
} satisfies Prisma.CocktailRecipeInclude;

export async function listCocktails(workspace: Workspace, opts: { search?: string; include?: string }): Promise<CocktailSummaryDto[]> {
  // Legacy semantics: fetch all of the workspace, then apply the free-text filter
  // in-memory over name/tags/garnishes/ingredients (see legacy cocktails/index.tsx).
  const cocktails = await prisma.cocktailRecipe.findMany({
    where: { workspaceId: workspace.id },
    include: {
      ...summaryInclude,
      garnishes: { include: { garnish: true } },
      steps: { include: { ingredients: { include: { ingredient: true } } } },
    },
  });

  const filtered =
    opts.search == undefined
      ? cocktails
      : (() => {
          const search = normalizeString(opts.search);
          return cocktails.filter(
            (cocktail) =>
              normalizeString(cocktail.name).includes(search) ||
              (cocktail.tags.some((tag) => normalizeString(tag).includes(search)) && search.length >= 3) ||
              (cocktail.garnishes.some((garnish) => normalizeString(garnish.garnish.name).includes(search)) && search.length >= 3) ||
              cocktail.steps.some((step) =>
                step.ingredients
                  .filter((ingredient) => ingredient.ingredient?.name != undefined)
                  .some(
                    (ingredient) =>
                      (normalizeString(ingredient.ingredient?.name).includes(search) && search.length >= 3) ||
                      (normalizeString(ingredient.ingredient?.shortName ?? '').includes(search) && search.length >= 3),
                  ),
              ),
          );
        })();

  // Optional `?include=` projections — the query above already loaded garnishes + step ingredients,
  // so this only reshapes in memory (no extra DB round-trips).
  const includeTokens = new Set(
    (opts.include ?? '')
      .split(',')
      .map((token) => token.trim())
      .filter(Boolean),
  );
  const wantGarnishes = includeTokens.has('garnishes');
  const wantIngredients = includeTokens.has('ingredients');

  return filtered.map((cocktail) => {
    if (!wantGarnishes && !wantIngredients) return toCocktailSummaryDto(cocktail, workspace.id);

    const distinctIngredients = new Map<string, { id: string; name: string; shortName: string | null }>();
    if (wantIngredients) {
      for (const step of cocktail.steps) {
        for (const line of step.ingredients) {
          if (line.ingredient)
            distinctIngredients.set(line.ingredient.id, { id: line.ingredient.id, name: line.ingredient.name, shortName: line.ingredient.shortName });
        }
      }
    }

    return toCocktailSummaryDto(cocktail, workspace.id, {
      garnishes: wantGarnishes ? cocktail.garnishes.map((g) => ({ id: g.garnish.id, name: g.garnish.name })) : undefined,
      ingredients: wantIngredients ? Array.from(distinctIngredients.values()) : undefined,
    });
  });
}

export async function getCocktail(workspace: Workspace, cocktailId: string): Promise<CocktailDto | null> {
  const cocktail = await prisma.cocktailRecipe.findFirst({
    where: { id: cocktailId, workspaceId: workspace.id },
    include: fullInclude,
  });
  return cocktail ? toCocktailDto(cocktail, workspace.id) : null;
}

export async function createCocktail(workspace: Workspace, user: User, input: CocktailCreateInput): Promise<CocktailDto> {
  const createdId = await prisma.$transaction(async (tx) => {
    const createdCocktail = await tx.cocktailRecipe.create({
      data: {
        id: input.id,
        name: input.name,
        description: input.description ?? null,
        notes: input.notes ?? null,
        history: input.history ?? null,
        tags: input.tags ?? [],
        price: input.price ?? null,
        ice: input.iceId ? { connect: { id: input.iceId } } : undefined,
        glass: input.glassId ? { connect: { id: input.glassId } } : undefined,
        workspace: { connect: { id: workspace.id } },
      },
    });

    if (input.image) {
      await tx.cocktailRecipeImage.create({
        data: { image: input.image, cocktailRecipeId: createdCocktail.id },
      });
    }

    for (const step of input.steps ?? []) {
      const createdStep = await tx.cocktailRecipeStep.create({
        data: {
          actionId: step.actionId,
          stepNumber: step.stepNumber,
          optional: step.optional ?? false,
          cocktailRecipeId: createdCocktail.id,
        },
      });

      for (const ing of step.ingredients ?? []) {
        await tx.cocktailRecipeIngredient.create({
          data: {
            amount: ing.amount ?? null,
            optional: ing.optional ?? false,
            ingredientNumber: ing.ingredientNumber,
            unitId: ing.unitId ?? null,
            ingredientId: ing.ingredientId ?? null,
            cocktailRecipeStepId: createdStep.id,
          },
        });
      }
    }

    for (const garnish of input.garnishes ?? []) {
      await tx.cocktailRecipeGarnish.create({
        data: {
          cocktailRecipeId: createdCocktail.id,
          garnishId: garnish.garnishId,
          garnishNumber: garnish.garnishNumber,
          description: garnish.description ?? null,
          optional: garnish.optional ?? false,
          isAlternative: garnish.isAlternative ?? false,
        },
      });
    }

    const fullCocktail = await tx.cocktailRecipe.findUnique({ where: { id: createdCocktail.id }, include: auditInclude });
    await createCocktailRecipeAuditLog(tx, workspace.id, user.id, createdCocktail.id, 'CREATE', null, fullCocktail);

    return createdCocktail.id;
  });

  const created = await getCocktail(workspace, createdId);
  if (!created) throw new ApiError(500, 'INTERNAL_ERROR', 'Cocktail could not be loaded after create');
  return created;
}

export async function updateCocktail(workspace: Workspace, user: User, cocktailId: string, input: CocktailUpdateInput): Promise<CocktailDto> {
  const existing = await prisma.cocktailRecipe.findFirst({ where: { id: cocktailId, workspaceId: workspace.id }, select: { id: true } });
  if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Cocktail not found');

  await prisma.$transaction(async (tx) => {
    const oldCocktail = await tx.cocktailRecipe.findUnique({ where: { id: cocktailId }, include: auditInclude });

    const updatedCocktail = await tx.cocktailRecipe.update({
      where: { id: cocktailId },
      data: {
        name: input.name,
        description: input.description ?? null,
        notes: input.notes ?? null,
        history: input.history ?? null,
        tags: input.tags ?? [],
        price: input.price ?? null,
        ice: input.iceId ? { connect: { id: input.iceId } } : { disconnect: true },
        glass: input.glassId ? { connect: { id: input.glassId } } : { disconnect: true },
        workspace: { connect: { id: workspace.id } },
      },
    });

    // Image handling (max. one image): drop and re-create when provided.
    await tx.cocktailRecipeImage.deleteMany({ where: { cocktailRecipeId: cocktailId } });
    if (input.image != undefined) {
      await tx.cocktailRecipeImage.create({ data: { cocktailRecipeId: cocktailId, image: input.image } });
    }

    // ---- Steps & Ingredients: differential update via ids ----
    const existingSteps = oldCocktail?.steps ?? [];
    const existingStepMap = new Map(existingSteps.map((s) => [s.id, s]));

    const incomingSteps = input.steps ?? [];
    const existingIncomingSteps = incomingSteps.filter((s) => s.id && s.id !== '');
    const incomingStepIds = new Set(existingIncomingSteps.map((s) => s.id));

    // Delete steps that no longer exist.
    const stepsToDelete = existingSteps.filter((s) => !incomingStepIds.has(s.id));
    for (const step of stepsToDelete) {
      await tx.cocktailRecipeStep.delete({ where: { id: step.id } });
    }

    // Update existing steps (and their ingredients differentially).
    for (const step of existingIncomingSteps) {
      const updatedStep = await tx.cocktailRecipeStep.update({
        where: { id: step.id },
        data: {
          stepNumber: step.stepNumber,
          optional: step.optional ?? false,
          actionId: step.actionId,
        },
      });

      const oldStep = existingStepMap.get(step.id!);
      const existingIngredients = oldStep?.ingredients ?? [];

      const incomingIngredients = step.ingredients ?? [];
      const incomingExistingIngredients = incomingIngredients.filter((i) => i.id && i.id !== '');
      const incomingIngredientIds = new Set(incomingExistingIngredients.map((i) => i.id));

      // Delete ingredients that no longer exist.
      const ingredientsToDelete = existingIngredients.filter((i) => !incomingIngredientIds.has(i.id));
      for (const ing of ingredientsToDelete) {
        await tx.cocktailRecipeIngredient.delete({ where: { id: ing.id } });
      }

      // Update existing ingredients.
      for (const ing of incomingExistingIngredients) {
        await tx.cocktailRecipeIngredient.update({
          where: { id: ing.id },
          data: {
            amount: ing.amount ?? null,
            optional: ing.optional ?? false,
            ingredientNumber: ing.ingredientNumber,
            unitId: ing.unitId ?? null,
            ingredientId: ing.ingredientId ?? null,
          },
        });
      }

      // Create new ingredients (without an existing id).
      const newIngredients = incomingIngredients.filter((i) => !i.id || i.id === '');
      for (const ing of newIngredients) {
        await tx.cocktailRecipeIngredient.create({
          data: {
            amount: ing.amount ?? null,
            optional: ing.optional ?? false,
            ingredientNumber: ing.ingredientNumber,
            unitId: ing.unitId ?? null,
            ingredientId: ing.ingredientId ?? null,
            cocktailRecipeStepId: updatedStep.id,
          },
        });
      }
    }

    // Create new steps (without an existing id).
    const newSteps = incomingSteps.filter((s) => !s.id || s.id === '');
    for (const step of newSteps) {
      const createdStep = await tx.cocktailRecipeStep.create({
        data: {
          actionId: step.actionId,
          stepNumber: step.stepNumber,
          optional: step.optional ?? false,
          cocktailRecipeId: updatedCocktail.id,
        },
      });

      for (const ing of step.ingredients ?? []) {
        await tx.cocktailRecipeIngredient.create({
          data: {
            amount: ing.amount ?? null,
            optional: ing.optional ?? false,
            ingredientNumber: ing.ingredientNumber,
            unitId: ing.unitId ?? null,
            ingredientId: ing.ingredientId ?? null,
            cocktailRecipeStepId: createdStep.id,
          },
        });
      }
    }

    // ---- Garnishes: differential update via composite (garnishId) ----
    const existingGarnishes = oldCocktail?.garnishes ?? [];
    const existingGarnishIds = new Set(existingGarnishes.map((g) => g.garnishId));

    const incomingGarnishes = input.garnishes ?? [];
    const incomingGarnishIds = new Set(incomingGarnishes.map((g) => g.garnishId));

    // Delete garnishes that no longer exist.
    const garnishIdsToDelete = Array.from(existingGarnishIds).filter((id) => !incomingGarnishIds.has(id));
    if (garnishIdsToDelete.length > 0) {
      await tx.cocktailRecipeGarnish.deleteMany({
        where: { cocktailRecipeId: cocktailId, garnishId: { in: garnishIdsToDelete } },
      });
    }

    // Update existing / create new garnishes.
    for (const garnish of incomingGarnishes) {
      if (existingGarnishIds.has(garnish.garnishId)) {
        await tx.cocktailRecipeGarnish.update({
          where: { garnishId_cocktailRecipeId: { garnishId: garnish.garnishId, cocktailRecipeId: cocktailId } },
          data: {
            garnishNumber: garnish.garnishNumber,
            description: garnish.description ?? null,
            optional: garnish.optional ?? false,
            isAlternative: garnish.isAlternative ?? false,
          },
        });
      } else {
        await tx.cocktailRecipeGarnish.create({
          data: {
            cocktailRecipeId: cocktailId,
            garnishId: garnish.garnishId,
            garnishNumber: garnish.garnishNumber,
            description: garnish.description ?? null,
            optional: garnish.optional ?? false,
            isAlternative: garnish.isAlternative ?? false,
          },
        });
      }
    }

    const fullNewCocktail = await tx.cocktailRecipe.findUnique({ where: { id: cocktailId }, include: auditInclude });
    await createCocktailRecipeAuditLog(tx, workspace.id, user.id, cocktailId, 'UPDATE', oldCocktail, fullNewCocktail);
  });

  const updated = await getCocktail(workspace, cocktailId);
  if (!updated) throw new ApiError(500, 'INTERNAL_ERROR', 'Cocktail could not be loaded after update');
  return updated;
}

export async function deleteCocktail(workspace: Workspace, user: User, cocktailId: string): Promise<{ count: number }> {
  await prisma.$transaction(async (tx) => {
    const oldCocktail = await tx.cocktailRecipe.findUnique({ where: { id: cocktailId }, include: auditInclude });

    await tx.cocktailRecipeIngredient.deleteMany({ where: { cocktailRecipeStep: { cocktailRecipeId: cocktailId } } });
    await tx.cocktailRecipeStep.deleteMany({ where: { cocktailRecipeId: cocktailId } });
    await tx.cocktailRecipe.delete({ where: { id: cocktailId, workspaceId: workspace.id } });

    await createCocktailRecipeAuditLog(tx, workspace.id, user.id, cocktailId, 'DELETE', oldCocktail, null);
  });

  return { count: 1 };
}

export async function archiveCocktail(workspace: Workspace, cocktailId: string, isArchived: boolean): Promise<CocktailDto> {
  const existing = await prisma.cocktailRecipe.findFirst({ where: { id: cocktailId, workspaceId: workspace.id }, select: { id: true } });
  if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Cocktail not found');

  // Legacy: bare update of the isArchived flag (no audit log).
  await prisma.cocktailRecipe.update({
    where: { id: cocktailId, workspaceId: workspace.id },
    data: { isArchived },
  });

  const updated = await getCocktail(workspace, cocktailId);
  if (!updated) throw new ApiError(500, 'INTERNAL_ERROR', 'Cocktail could not be loaded after archive');
  return updated;
}

export async function cloneCocktail(workspace: Workspace, user: User, cocktailId: string, name: string): Promise<CocktailDto> {
  const cloneId = await prisma.$transaction(async (tx) => {
    // Faithful replica of the legacy clone handler (deep copy incl. image, steps, ingredients and garnishes).
    const existing = await tx.cocktailRecipe.findFirst({
      where: { id: cocktailId, workspaceId: workspace.id },
      include: {
        ice: true,
        glass: { include: { _count: { select: { GlassImage: true } } } },
        CocktailRecipeImage: { select: { image: true } },
        garnishes: { include: { garnish: true } },
        steps: { include: { action: true, ingredients: { include: { ingredient: true, unit: true } } } },
      },
    });

    if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Cocktail not found');

    const createData: Prisma.CocktailRecipeCreateInput = {
      name,
      description: existing.description,
      notes: existing.notes,
      history: existing.history,
      tags: existing.tags,
      price: existing.price,
      workspace: { connect: { id: workspace.id } },
    };

    if (existing.iceId) createData.ice = { connect: { id: existing.iceId } };
    if (existing.glassId) createData.glass = { connect: { id: existing.glassId } };

    const createClone = await tx.cocktailRecipe.create({ data: createData });

    if (existing.CocktailRecipeImage && existing.CocktailRecipeImage.length > 0) {
      await tx.cocktailRecipeImage.create({
        data: { image: existing.CocktailRecipeImage[0].image, cocktailRecipe: { connect: { id: createClone.id } } },
      });
    }

    if (existing.steps && existing.steps.length > 0) {
      const sortedSteps = [...existing.steps].sort((a, b) => a.stepNumber - b.stepNumber);
      for (const step of sortedSteps) {
        await tx.cocktailRecipeStep.create({
          data: {
            action: { connect: { id: step.actionId } },
            stepNumber: step.stepNumber,
            optional: step.optional,
            cocktailRecipe: { connect: { id: createClone.id } },
            ingredients: {
              create: step.ingredients.map((stepIngredient) => ({
                amount: stepIngredient.amount,
                optional: stepIngredient.optional,
                ingredientNumber: stepIngredient.ingredientNumber,
                unit: { connect: { id: stepIngredient.unitId } },
                ingredient: { connect: { id: stepIngredient.ingredientId } },
              })),
            },
          },
        });
      }
    }

    if (existing.garnishes && existing.garnishes.length > 0) {
      for (const garnish of existing.garnishes) {
        await tx.cocktailRecipeGarnish.create({
          data: {
            cocktailRecipe: { connect: { id: createClone.id } },
            garnish: { connect: { id: garnish.garnishId } },
            garnishNumber: garnish.garnishNumber,
            description: garnish.description,
            optional: garnish.optional,
          },
        });
      }
    }

    const fullClone = await tx.cocktailRecipe.findUnique({ where: { id: createClone.id }, include: auditInclude });
    await createCocktailRecipeAuditLog(tx, workspace.id, user.id, createClone.id, 'CREATE', null, fullClone);

    return createClone.id;
  });

  const clone = await getCocktail(workspace, cloneId);
  if (!clone) throw new ApiError(500, 'INTERNAL_ERROR', 'Cocktail could not be loaded after clone');
  return clone;
}

export async function checkCocktail(workspace: Workspace, name: string): Promise<CocktailSummaryDto | null> {
  if (name.length < 3) return null;

  const allCocktails = await prisma.cocktailRecipe.findMany({ where: { workspaceId: workspace.id }, include: summaryInclude });

  let best: (typeof allCocktails)[number] | null = null;
  let maxSimilarity = 0;
  for (const cocktail of allCocktails) {
    const similarity = calculateCocktailRecipeSimilarity(name, cocktail);
    if (similarity > maxSimilarity) {
      maxSimilarity = similarity;
      best = cocktail;
    }
  }

  return best && maxSimilarity > 0.5 ? toCocktailSummaryDto(best, workspace.id) : null;
}

export async function getCocktailImage(workspace: Workspace, cocktailId: string): Promise<{ contentType: string; bytes: Buffer } | null> {
  const result = await prisma.cocktailRecipeImage.findFirst({
    where: { cocktailRecipeId: cocktailId, cocktailRecipe: { workspaceId: workspace.id } },
    select: { image: true },
  });

  if (!result?.image) return null;

  const contentType = result.image.split(';')[0].split(':')[1];
  const decoded = result.image.split(',')[1];
  return { contentType, bytes: Buffer.from(decoded, 'base64') };
}
