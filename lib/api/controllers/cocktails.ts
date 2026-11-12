/**
 * Business logic for cocktails (v1): CRUD with the differential PUT of
 * steps/ingredients/garnishes, archive/availability flags and clone. Returns
 * clean public DTOs (lib/api/dto/cocktails.ts). Every id from a request body is
 * checked against the workspace (and child ids against the cocktail) inside the
 * write transaction.
 */
import prisma from '../../../prisma/prisma';
import { createCocktailRecipeAuditLog, createLog } from '@lib/auditLog';
import { assertIdsInWorkspace } from '@lib/api/scope';
import { lockWorkspaceScope, runTx, type Tx } from '@lib/db/tx';
import { decodeStoredImage, type DecodedImage } from '@lib/images/imageResponse';
import { calculateCocktailRecipeSimilarity } from '@lib/findSimilarEntities';
import { normalizeString } from '@lib/StringUtils';
import { ApiError } from '@lib/http/ApiError';
import { toCocktailDto, toCocktailSummaryDto } from '@lib/api/dto/cocktails';
import type { Prisma, User, Workspace } from '@generated/prisma/client';
import { WorkspaceSettingKey } from '@generated/prisma/client';
import { loadWorkspaceLocaleSettings } from '@lib/workspace/workspaceLocaleSettings.server';
import { getNextBarDayStart } from '@lib/cards/activeCard';
import type {
  CocktailCreateInput,
  CocktailDto,
  CocktailGarnishInput,
  CocktailStepIngredientInput,
  CocktailSummaryDto,
  CocktailUpdateInput,
} from '@lib/schemas/cocktails';

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

/** Every id a create/update body references must belong to the workspace (400 INVALID_REFERENCE otherwise). */
async function assertCocktailRefsInWorkspace(tx: Tx, workspaceId: string, input: CocktailCreateInput | CocktailUpdateInput): Promise<void> {
  const steps = input.steps ?? [];
  const lines = steps.flatMap((step) => step.ingredients ?? []);
  await assertIdsInWorkspace(tx, workspaceId, {
    glass: [input.glassId],
    ice: [input.iceId],
    action: steps.map((step) => step.actionId),
    ingredient: lines.map((line) => line.ingredientId),
    unit: lines.map((line) => line.unitId),
    garnish: (input.garnishes ?? []).map((garnish) => garnish.garnishId),
  });
}

function stepIngredientData(ing: CocktailStepIngredientInput) {
  return {
    amount: ing.amount ?? null,
    optional: ing.optional ?? false,
    ingredientNumber: ing.ingredientNumber,
    unitId: ing.unitId ?? null,
    ingredientId: ing.ingredientId ?? null,
  };
}

function garnishData(garnish: CocktailGarnishInput) {
  return {
    garnishNumber: garnish.garnishNumber,
    description: garnish.description ?? null,
    optional: garnish.optional ?? false,
    isAlternative: garnish.isAlternative ?? false,
  };
}

export async function createCocktail(workspace: Workspace, user: User, input: CocktailCreateInput): Promise<CocktailDto> {
  const createdId = await runTx(async (tx) => {
    await assertCocktailRefsInWorkspace(tx, workspace.id, input);

    const createdCocktail = await tx.cocktailRecipe.create({
      data: {
        id: input.id,
        name: input.name,
        description: input.description ?? null,
        notes: input.notes ?? null,
        history: input.history ?? null,
        tags: input.tags ?? [],
        price: input.price ?? null,
        abvOverride: input.abvOverride,
        extraAllergens: input.extraAllergens,
        extraAdditives: input.extraAdditives,
        iceId: input.iceId ?? null,
        glassId: input.glassId ?? null,
        workspaceId: workspace.id,
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
        await tx.cocktailRecipeIngredient.create({ data: { ...stepIngredientData(ing), cocktailRecipeStepId: createdStep.id } });
      }
    }

    for (const garnish of input.garnishes ?? []) {
      await tx.cocktailRecipeGarnish.create({
        data: { cocktailRecipeId: createdCocktail.id, garnishId: garnish.garnishId, ...garnishData(garnish) },
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

/**
 * Step / ingredient-line ids in an update body may only reference rows of the
 * cocktail being updated (never another cocktail's or workspace's rows), and
 * each at most once.
 */
function assertOwnChildIds(input: CocktailUpdateInput, oldStepIds: Set<string>, oldLineIds: Set<string>): void {
  const seenSteps = new Set<string>();
  const seenLines = new Set<string>();
  const issues: string[] = [];
  for (const step of input.steps ?? []) {
    if (step.id) {
      if (!oldStepIds.has(step.id) || seenSteps.has(step.id)) issues.push(`step ${step.id}`);
      seenSteps.add(step.id);
    }
    for (const line of step.ingredients ?? []) {
      if (!line.id) continue;
      if (!oldLineIds.has(line.id) || seenLines.has(line.id)) issues.push(`ingredient line ${line.id}`);
      seenLines.add(line.id);
    }
  }
  if (issues.length > 0) {
    throw new ApiError(400, 'INVALID_REFERENCE', 'Steps or ingredient lines do not belong to this cocktail', issues);
  }
}

export async function updateCocktail(workspace: Workspace, user: User, cocktailId: string, input: CocktailUpdateInput): Promise<CocktailDto> {
  await runTx(async (tx) => {
    // Serializes concurrent updates of the same cocktail (differential child writes).
    await lockWorkspaceScope(tx, workspace.id, `cocktail:${cocktailId}`);
    const oldCocktail = await tx.cocktailRecipe.findFirst({ where: { id: cocktailId, workspaceId: workspace.id }, include: auditInclude });
    if (!oldCocktail) throw new ApiError(404, 'NOT_FOUND', 'Cocktail not found');

    const oldStepIds = new Set(oldCocktail.steps.map((step) => step.id));
    const oldLineIds = new Set(oldCocktail.steps.flatMap((step) => step.ingredients.map((line) => line.id)));
    assertOwnChildIds(input, oldStepIds, oldLineIds);
    await assertCocktailRefsInWorkspace(tx, workspace.id, input);

    await tx.cocktailRecipe.update({
      where: { id: cocktailId, workspaceId: workspace.id },
      data: {
        name: input.name,
        description: input.description ?? null,
        notes: input.notes ?? null,
        history: input.history ?? null,
        tags: input.tags ?? [],
        price: input.price ?? null,
        abvOverride: input.abvOverride,
        extraAllergens: input.extraAllergens,
        extraAdditives: input.extraAdditives,
        ice: input.iceId ? { connect: { id: input.iceId } } : { disconnect: true },
        glass: input.glassId ? { connect: { id: input.glassId } } : { disconnect: true },
      },
    });

    // Image handling (max. one image): drop and re-create when provided.
    await tx.cocktailRecipeImage.deleteMany({ where: { cocktailRecipeId: cocktailId } });
    if (input.image != undefined) {
      await tx.cocktailRecipeImage.create({ data: { cocktailRecipeId: cocktailId, image: input.image } });
    }

    // ---- Steps & ingredient lines: differential update via ids ----
    // Upsert steps first, then lines (a line may move to another step of this
    // cocktail), and delete what is no longer present last, so a moved line is
    // never removed by the cascade of its former step.
    const incomingSteps = input.steps ?? [];
    const keptStepIds = new Set<string>();
    const keptLineIds = new Set<string>();

    for (const step of incomingSteps) {
      const stepData = { stepNumber: step.stepNumber, optional: step.optional ?? false, actionId: step.actionId };
      const stepId = step.id
        ? (await tx.cocktailRecipeStep.update({ where: { id: step.id, cocktailRecipeId: cocktailId }, data: stepData })).id
        : (await tx.cocktailRecipeStep.create({ data: { ...stepData, cocktailRecipeId: cocktailId } })).id;
      keptStepIds.add(stepId);

      for (const ing of step.ingredients ?? []) {
        const lineData = { ...stepIngredientData(ing), cocktailRecipeStepId: stepId };
        if (ing.id) {
          await tx.cocktailRecipeIngredient.update({ where: { id: ing.id }, data: lineData });
          keptLineIds.add(ing.id);
        } else {
          await tx.cocktailRecipeIngredient.create({ data: lineData });
        }
      }
    }

    const linesToDelete = [...oldLineIds].filter((id) => !keptLineIds.has(id));
    if (linesToDelete.length > 0) {
      await tx.cocktailRecipeIngredient.deleteMany({ where: { id: { in: linesToDelete }, cocktailRecipeStep: { cocktailRecipeId: cocktailId } } });
    }
    const stepsToDelete = [...oldStepIds].filter((id) => !keptStepIds.has(id));
    if (stepsToDelete.length > 0) {
      await tx.cocktailRecipeStep.deleteMany({ where: { id: { in: stepsToDelete }, cocktailRecipeId: cocktailId } });
    }

    // ---- Garnishes: differential update via composite (garnishId) ----
    const existingGarnishIds = new Set(oldCocktail.garnishes.map((g) => g.garnishId));
    const incomingGarnishes = input.garnishes ?? [];
    const incomingGarnishIds = new Set(incomingGarnishes.map((g) => g.garnishId));

    const garnishIdsToDelete = Array.from(existingGarnishIds).filter((id) => !incomingGarnishIds.has(id));
    if (garnishIdsToDelete.length > 0) {
      await tx.cocktailRecipeGarnish.deleteMany({
        where: { cocktailRecipeId: cocktailId, garnishId: { in: garnishIdsToDelete } },
      });
    }

    for (const garnish of incomingGarnishes) {
      if (existingGarnishIds.has(garnish.garnishId)) {
        await tx.cocktailRecipeGarnish.update({
          where: { garnishId_cocktailRecipeId: { garnishId: garnish.garnishId, cocktailRecipeId: cocktailId } },
          data: garnishData(garnish),
        });
      } else {
        await tx.cocktailRecipeGarnish.create({
          data: { cocktailRecipeId: cocktailId, garnishId: garnish.garnishId, ...garnishData(garnish) },
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
  await runTx(async (tx) => {
    const oldCocktail = await tx.cocktailRecipe.findFirst({ where: { id: cocktailId, workspaceId: workspace.id }, include: auditInclude });
    if (!oldCocktail) throw new ApiError(404, 'NOT_FOUND', 'Cocktail not found');

    await tx.cocktailRecipeIngredient.deleteMany({ where: { cocktailRecipeStep: { cocktailRecipeId: cocktailId } } });
    await tx.cocktailRecipeStep.deleteMany({ where: { cocktailRecipeId: cocktailId } });
    await tx.cocktailRecipe.delete({ where: { id: cocktailId, workspaceId: workspace.id } });

    await createCocktailRecipeAuditLog(tx, workspace.id, user.id, cocktailId, 'DELETE', oldCocktail, null);
  });

  return { count: 1 };
}

/** Flag changes (archive, availability) are not part of the recipe snapshot, so they are logged as a plain field diff. */
async function updateCocktailFlags(
  workspace: Workspace,
  user: User,
  cocktailId: string,
  data: { isArchived?: boolean; unavailableUntil?: Date | null },
): Promise<void> {
  await runTx(async (tx) => {
    const old = await tx.cocktailRecipe.findFirst({
      where: { id: cocktailId, workspaceId: workspace.id },
      select: { name: true, isArchived: true, unavailableUntil: true },
    });
    if (!old) throw new ApiError(404, 'NOT_FOUND', 'Cocktail not found');

    const updated = await tx.cocktailRecipe.update({
      where: { id: cocktailId, workspaceId: workspace.id },
      data,
      select: { name: true, isArchived: true, unavailableUntil: true },
    });

    const pick = (row: typeof old) => ({
      name: row.name,
      ...('isArchived' in data ? { isArchived: row.isArchived } : {}),
      ...('unavailableUntil' in data ? { unavailableUntil: row.unavailableUntil?.toISOString() ?? null } : {}),
    });
    await createLog(tx, workspace.id, user.id, 'CocktailRecipe', cocktailId, 'UPDATE', pick(old), pick(updated));
  });
}

export async function archiveCocktail(workspace: Workspace, user: User, cocktailId: string, isArchived: boolean): Promise<CocktailDto> {
  await updateCocktailFlags(workspace, user, cocktailId, { isArchived });

  const updated = await getCocktail(workspace, cocktailId);
  if (!updated) throw new ApiError(500, 'INTERNAL_ERROR', 'Cocktail could not be loaded after archive');
  return updated;
}

/**
 * "Heute aus": marks the cocktail unavailable until the next bar day starts
 * (workspace timezone + statisticDayStartTime), or clears the flag.
 */
export async function setCocktailAvailability(
  workspace: Workspace,
  user: User,
  cocktailId: string,
  unavailable: boolean,
  now = new Date(),
): Promise<CocktailDto> {
  let unavailableUntil: Date | null = null;
  if (unavailable) {
    const [{ timezone }, dayStartSetting] = await Promise.all([
      loadWorkspaceLocaleSettings(workspace.id),
      prisma.workspaceSetting.findUnique({
        where: { workspaceId_setting: { workspaceId: workspace.id, setting: WorkspaceSettingKey.statisticDayStartTime } },
      }),
    ]);
    unavailableUntil = getNextBarDayStart(now, { timezone, dayStartTime: dayStartSetting?.value });
  }

  await updateCocktailFlags(workspace, user, cocktailId, { unavailableUntil });

  const updated = await getCocktail(workspace, cocktailId);
  if (!updated) throw new ApiError(500, 'INTERNAL_ERROR', 'Cocktail could not be loaded after availability change');
  return updated;
}

export async function cloneCocktail(workspace: Workspace, user: User, cocktailId: string, name: string): Promise<CocktailDto> {
  const cloneId = await runTx(async (tx) => {
    // Deep copy incl. image, steps, ingredients and garnishes. All referenced ids come
    // from the scoped source cocktail, so they belong to this workspace.
    const existing = await tx.cocktailRecipe.findFirst({
      where: { id: cocktailId, workspaceId: workspace.id },
      include: {
        CocktailRecipeImage: { select: { image: true } },
        garnishes: true,
        steps: { include: { ingredients: true }, orderBy: { stepNumber: 'asc' } },
      },
    });

    if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Cocktail not found');

    const createClone = await tx.cocktailRecipe.create({
      data: {
        name,
        description: existing.description,
        notes: existing.notes,
        history: existing.history,
        tags: existing.tags,
        price: existing.price,
        abvOverride: existing.abvOverride,
        extraAllergens: existing.extraAllergens,
        extraAdditives: existing.extraAdditives,
        iceId: existing.iceId,
        glassId: existing.glassId,
        workspaceId: workspace.id,
      },
    });

    if (existing.CocktailRecipeImage.length > 0) {
      await tx.cocktailRecipeImage.create({
        data: { image: existing.CocktailRecipeImage[0].image, cocktailRecipeId: createClone.id },
      });
    }

    for (const step of existing.steps) {
      await tx.cocktailRecipeStep.create({
        data: {
          actionId: step.actionId,
          stepNumber: step.stepNumber,
          optional: step.optional,
          cocktailRecipeId: createClone.id,
          ingredients: {
            create: step.ingredients.map((stepIngredient) => ({
              amount: stepIngredient.amount,
              optional: stepIngredient.optional,
              ingredientNumber: stepIngredient.ingredientNumber,
              unitId: stepIngredient.unitId,
              ingredientId: stepIngredient.ingredientId,
            })),
          },
        },
      });
    }

    for (const garnish of existing.garnishes) {
      await tx.cocktailRecipeGarnish.create({
        data: {
          cocktailRecipeId: createClone.id,
          garnishId: garnish.garnishId,
          garnishNumber: garnish.garnishNumber,
          description: garnish.description,
          optional: garnish.optional,
          isAlternative: garnish.isAlternative,
        },
      });
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

export async function getCocktailImage(workspace: Workspace, cocktailId: string): Promise<DecodedImage | null> {
  const result = await prisma.cocktailRecipeImage.findFirst({
    where: { cocktailRecipeId: cocktailId, cocktailRecipe: { workspaceId: workspace.id } },
    select: { image: true },
  });
  return decodeStoredImage(result?.image);
}
