/**
 * Version-agnostic business logic for ingredients (v1). Same DB operations as the
 * legacy handlers, but returns clean public DTOs (lib/api/dto/ingredients.ts).
 * Legacy routes remain wrapped-but-untouched and keep their raw Prisma shapes.
 */
import prisma from '../../../prisma/prisma';
import { createLog } from '@lib/auditLog';
import { calculateIngredientSimilarity } from '@lib/findSimilarEntities';
import levenshtein from 'js-levenshtein';
import { ApiError } from '@lib/http/ApiError';
import { toIngredientDto } from '@lib/api/dto/ingredients';
import packageJson from '../../../package.json';
import type { IngredientExportStructure } from '@lib/auditExport';
import type { Prisma, User, Workspace } from '@generated/prisma/client';
import type { IngredientCreateInput, IngredientDto, IngredientUpdateInput } from '@lib/schemas/ingredients';

const ingredientInclude = {
  IngredientVolume: { include: { unit: true } },
  _count: { select: { IngredientImage: true } },
} satisfies Prisma.IngredientInclude;

export async function listIngredients(workspace: Workspace, opts: { search?: string }): Promise<IngredientDto[]> {
  const where: Prisma.IngredientWhereInput = { workspaceId: workspace.id };
  if (opts.search) {
    where.OR = [{ name: { contains: opts.search, mode: 'insensitive' } }, { shortName: { contains: opts.search, mode: 'insensitive' } }];
  }
  const ingredients = await prisma.ingredient.findMany({ where, include: ingredientInclude });
  return ingredients.map((ingredient) => toIngredientDto(ingredient, ingredient._count.IngredientImage > 0, workspace.id));
}

export async function getIngredient(workspace: Workspace, ingredientId: string): Promise<IngredientDto | null> {
  const ingredient = await prisma.ingredient.findUnique({
    where: { id: ingredientId, workspaceId: workspace.id },
    include: ingredientInclude,
  });
  return ingredient ? toIngredientDto(ingredient, ingredient._count.IngredientImage > 0, workspace.id) : null;
}

export async function createIngredient(workspace: Workspace, user: User, input: IngredientCreateInput): Promise<IngredientDto> {
  const created = await prisma.$transaction(async (tx) => {
    const result = await tx.ingredient.create({
      data: {
        id: input.id,
        name: input.name,
        notes: input.notes ?? undefined,
        description: input.description ?? undefined,
        shortName: input.shortName ?? undefined,
        price: input.price ?? undefined,
        link: input.link ?? undefined,
        tags: input.tags ?? undefined,
        workspace: { connect: { id: workspace.id } },
      },
    });

    if (input.units) {
      for (const unit of input.units) {
        await tx.ingredientVolume.create({
          data: {
            volume: unit.volume,
            unit: { connect: { id: unit.unitId } },
            ingredient: { connect: { id: result.id } },
            workspace: { connect: { id: workspace.id } },
          },
        });
      }
    }

    if (input.image) {
      await tx.ingredientImage.create({ data: { image: input.image, ingredient: { connect: { id: result.id } } } });
    }

    const fullIngredient = await tx.ingredient.findUniqueOrThrow({ where: { id: result.id }, include: ingredientInclude });
    await createLog(tx, workspace.id, user.id, 'Ingredient', result.id, 'CREATE', null, fullIngredient);
    return fullIngredient;
  });

  return toIngredientDto(created, Boolean(input.image), workspace.id);
}

export async function updateIngredient(workspace: Workspace, user: User, ingredientId: string, input: IngredientUpdateInput): Promise<IngredientDto> {
  const updated = await prisma.$transaction(async (tx) => {
    const oldIngredient = await tx.ingredient.findUnique({
      where: { id: ingredientId },
      include: { IngredientVolume: { include: { unit: true } }, IngredientImage: true },
    });

    const result = await tx.ingredient.update({
      where: { id: ingredientId },
      data: {
        id: ingredientId,
        name: input.name,
        shortName: input.shortName ?? undefined,
        notes: input.notes ?? undefined,
        description: input.description ?? undefined,
        price: input.price ?? undefined,
        link: input.link ?? undefined,
        tags: input.tags ?? undefined,
        workspace: { connect: { id: workspace.id } },
      },
    });

    await tx.ingredientVolume.deleteMany({ where: { ingredientId } });
    await tx.ingredientImage.deleteMany({ where: { ingredientId } });

    if (input.image) {
      await tx.ingredientImage.create({ data: { ingredientId, image: input.image } });
    }

    if (input.units) {
      for (const unit of input.units) {
        await tx.ingredientVolume.create({
          data: {
            unit: { connect: { id: unit.unitId } },
            ingredient: { connect: { id: result.id } },
            volume: unit.volume,
            workspace: { connect: { id: workspace.id } },
          },
        });
      }
    }

    const fullNewIngredient = await tx.ingredient.findUniqueOrThrow({ where: { id: result.id }, include: ingredientInclude });
    await createLog(tx, workspace.id, user.id, 'Ingredient', result.id, 'UPDATE', oldIngredient, fullNewIngredient);
    return fullNewIngredient;
  });

  return toIngredientDto(updated, Boolean(input.image), workspace.id);
}

export async function deleteIngredient(workspace: Workspace, user: User, ingredientId: string): Promise<{ count: number }> {
  // Prüfe, ob die Zutat noch in Cocktail-Rezepten verwendet wird
  const cocktailRecipeIngredients = await prisma.cocktailRecipeIngredient.findMany({
    where: { ingredientId },
    include: {
      cocktailRecipeStep: {
        include: {
          cocktailRecipe: { select: { id: true, name: true, workspaceId: true } },
        },
      },
    },
  });

  const uniqueCocktails = new Map<string, { id: string; name: string }>();
  cocktailRecipeIngredients.forEach((cri) => {
    const cocktail = cri.cocktailRecipeStep.cocktailRecipe;
    if (cocktail.workspaceId === workspace.id) {
      uniqueCocktails.set(cocktail.id, { id: cocktail.id, name: cocktail.name });
    }
  });

  const cocktails = Array.from(uniqueCocktails.values());
  if (cocktails.length > 0) {
    throw new ApiError(409, 'INGREDIENT_IN_USE', `The ingredient is still used in ${cocktails.length} cocktail(s) and cannot be deleted.`, {
      cocktails,
    });
  }

  await prisma.$transaction(async (tx) => {
    const oldIngredient = await tx.ingredient.findUnique({
      where: { id: ingredientId },
      include: { IngredientVolume: { include: { unit: true } }, IngredientImage: true },
    });
    await tx.ingredient.delete({ where: { id: ingredientId, workspaceId: workspace.id } });
    await createLog(tx, workspace.id, user.id, 'Ingredient', ingredientId, 'DELETE', oldIngredient, null);
  });

  return { count: 1 };
}

export async function checkIngredient(workspace: Workspace, opts: { name?: string; link?: string }): Promise<IngredientDto | null> {
  const allIngredients = await prisma.ingredient.findMany({ where: { workspaceId: workspace.id }, include: ingredientInclude });

  if (typeof opts.name === 'string') {
    if (opts.name.length < 3) return null;

    let best: (typeof allIngredients)[number] | null = null;
    let maxSimilarity = 0;
    for (const ingredient of allIngredients) {
      const similarity = calculateIngredientSimilarity(opts.name, ingredient);
      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        best = ingredient;
      }
    }

    return best && maxSimilarity > 0.5 ? toIngredientDto(best, best._count.IngredientImage > 0, workspace.id) : null;
  }

  if (typeof opts.link === 'string') {
    const link = opts.link;
    const best = allIngredients
      .filter((ingredient) => ingredient.link != null)
      .find((ingredient) => 1 - levenshtein(ingredient.link!, link) / Math.max(ingredient.link!.length, link.length) > 0.8);
    return best ? toIngredientDto(best, best._count.IngredientImage > 0, workspace.id) : null;
  }

  throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid query');
}

export async function cloneIngredient(workspace: Workspace, ingredientId: string, name: string): Promise<IngredientDto> {
  const created = await prisma.$transaction(async (tx) => {
    const existing = await tx.ingredient.findFirst({
      where: { id: ingredientId, workspaceId: workspace.id },
      include: {
        IngredientVolume: { include: { unit: true } },
        IngredientImage: { select: { image: true } },
      },
    });

    if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Ingredient not found');

    const createClone = await tx.ingredient.create({
      data: {
        name,
        shortName: existing.shortName,
        notes: existing.notes,
        description: existing.description,
        price: existing.price,
        link: existing.link,
        tags: existing.tags,
        workspace: { connect: { id: workspace.id } },
      },
    });

    if (existing.IngredientImage && existing.IngredientImage.length > 0) {
      await tx.ingredientImage.create({ data: { ingredientId: createClone.id, image: existing.IngredientImage[0].image } });
    }

    if (existing.IngredientVolume && existing.IngredientVolume.length > 0) {
      for (const volume of existing.IngredientVolume) {
        await tx.ingredientVolume.create({
          data: {
            unit: { connect: { id: volume.unitId } },
            ingredient: { connect: { id: createClone.id } },
            volume: volume.volume,
            workspace: { connect: { id: workspace.id } },
          },
        });
      }
    }

    return tx.ingredient.findUniqueOrThrow({ where: { id: createClone.id }, include: ingredientInclude });
  });

  return toIngredientDto(created, created._count.IngredientImage > 0, workspace.id);
}

export async function getIngredientReferences(workspace: Workspace, ingredientId: string): Promise<Array<{ id: string; name: string }>> {
  const cocktailRecipeIngredients = await prisma.cocktailRecipeIngredient.findMany({
    where: { ingredientId },
    include: {
      cocktailRecipeStep: {
        include: {
          cocktailRecipe: { select: { id: true, name: true, workspaceId: true } },
        },
      },
    },
  });

  const uniqueCocktails = new Map<string, { id: string; name: string }>();
  cocktailRecipeIngredients.forEach((cri) => {
    const cocktail = cri.cocktailRecipeStep.cocktailRecipe;
    if (cocktail.workspaceId === workspace.id) {
      uniqueCocktails.set(cocktail.id, { id: cocktail.id, name: cocktail.name });
    }
  });

  return Array.from(uniqueCocktails.values());
}

/**
 * Exports the given ingredients (with unit volumes and units) in the exact legacy
 * export format: a single ingredient yields one IngredientExportStructure, multiple
 * yield an array. Returned verbatim by the route (not { data }-enveloped) so it
 * round-trips with import.
 */
export async function exportIngredientsJson(workspace: Workspace, ids: string[]): Promise<IngredientExportStructure | IngredientExportStructure[]> {
  const ingredients = await prisma.ingredient.findMany({
    where: { id: { in: ids }, workspaceId: workspace.id },
    include: { IngredientVolume: { include: { unit: true } } },
  });

  if (ingredients.length === 0) throw new ApiError(404, 'INGREDIENTS_NOT_FOUND', 'No ingredients found');

  const exportData: IngredientExportStructure[] = ingredients.map((ingredient) => {
    const unitsMap = new Map<string, { id: string; name: string; workspaceId: string }>();
    const ingredientVolumes = ingredient.IngredientVolume.map((v) => {
      if (v.unit) {
        unitsMap.set(v.unit.id, { id: v.unit.id, name: v.unit.name, workspaceId: v.unit.workspaceId });
      }
      return {
        id: v.id,
        volume: v.volume,
        ingredientId: ingredient.id,
        unitId: v.unitId,
        workspaceId: v.workspaceId,
      };
    });

    return {
      exportVersion: packageJson.version,
      exportDate: new Date().toISOString(),
      ingredient: {
        id: ingredient.id,
        name: ingredient.name,
        shortName: ingredient.shortName,
        description: ingredient.description,
        notes: ingredient.notes,
        price: ingredient.price,
        link: ingredient.link,
        tags: ingredient.tags,
        workspaceId: ingredient.workspaceId,
      },
      ingredientVolumes,
      units: Array.from(unitsMap.values()),
    };
  });

  return exportData.length === 1 ? exportData[0] : exportData;
}

interface IngredientImportDecision {
  exportName: string;
  decision: 'import' | 'overwrite' | 'rename' | 'skip';
  existingId?: string;
  newName?: string;
  data: IngredientExportStructure;
}

async function createImportVolumes(tx: Prisma.TransactionClient, ingredientId: string, workspaceId: string, itemData: IngredientExportStructure) {
  if (!itemData.ingredientVolumes || !itemData.units) return;

  for (const vol of itemData.ingredientVolumes) {
    const exportUnit = itemData.units.find((u) => u.id === vol.unitId);
    if (!exportUnit) continue;

    let unit = await tx.unit.findFirst({ where: { name: exportUnit.name, workspaceId } });
    if (!unit) {
      unit = await tx.unit.create({ data: { name: exportUnit.name, workspaceId } });
    }

    await tx.ingredientVolume.create({ data: { volume: vol.volume, ingredientId, unitId: unit.id, workspaceId } });
  }
}

/**
 * Faithful replica of the legacy import three-phase flow. Returns the exact
 * legacy payloads per phase, sent verbatim by the route (not { data }-enveloped).
 */
export async function importIngredientsJson(
  workspace: Workspace,
  user: User,
  body: {
    phase: 'validate' | 'prepare-mapping' | 'execute';
    exportData: IngredientExportStructure | IngredientExportStructure[];
    decisions?: IngredientImportDecision[];
  },
): Promise<unknown> {
  const workspaceId = workspace.id;
  const items: IngredientExportStructure[] = Array.isArray(body.exportData) ? body.exportData : [body.exportData];

  if (body.phase === 'validate') {
    const entities = items.map((item) => {
      if (!item?.ingredient?.name) return { name: 'Unbekannt', valid: false };
      return { name: item.ingredient.name, valid: true };
    });
    return { valid: entities.every((e) => e.valid), entities };
  }

  if (body.phase === 'prepare-mapping') {
    const existingIngredients = await prisma.ingredient.findMany({ where: { workspaceId }, select: { id: true, name: true } });
    const entities = items.map((item) => {
      const name = item.ingredient?.name || 'Unbekannt';
      const conflicts = existingIngredients.filter((e) => e.name.toLowerCase() === name.toLowerCase());
      return { name, data: item, conflicts: conflicts.map((c) => ({ id: c.id, name: c.name })) };
    });
    return { entities };
  }

  if (body.phase === 'execute') {
    const decisions = body.decisions;
    if (!decisions || decisions.length === 0) {
      throw new ApiError(400, 'NO_DECISIONS', 'No decisions provided');
    }

    const results: Array<{ name: string; status: string; message?: string }> = [];

    await prisma.$transaction(async (tx) => {
      for (const decision of decisions) {
        if (decision.decision === 'skip') {
          results.push({ name: decision.exportName, status: 'skipped' });
          continue;
        }

        const itemData = decision.data;
        if (!itemData?.ingredient) continue;

        const finalName = decision.decision === 'rename' && decision.newName ? decision.newName : itemData.ingredient.name;

        try {
          if (decision.decision === 'overwrite' && decision.existingId) {
            const oldData = await tx.ingredient.findUnique({
              where: { id: decision.existingId },
              include: { IngredientImage: true, IngredientVolume: { include: { unit: true } } },
            });

            await tx.ingredientVolume.deleteMany({ where: { ingredientId: decision.existingId } });

            await tx.ingredient.update({
              where: { id: decision.existingId },
              data: {
                name: finalName,
                shortName: itemData.ingredient.shortName ?? null,
                description: itemData.ingredient.description ?? null,
                notes: itemData.ingredient.notes ?? null,
                price: itemData.ingredient.price ?? null,
                link: itemData.ingredient.link ?? null,
                tags: itemData.ingredient.tags ?? [],
              },
            });

            await createImportVolumes(tx, decision.existingId, workspaceId, itemData);

            const fullUpdated = await tx.ingredient.findUnique({
              where: { id: decision.existingId },
              include: { IngredientImage: true, IngredientVolume: { include: { unit: true } } },
            });

            await createLog(tx, workspaceId, user.id, 'Ingredient', decision.existingId, 'UPDATE', oldData, fullUpdated);
            results.push({ name: finalName, status: 'overwritten' });
          } else {
            const created = await tx.ingredient.create({
              data: {
                name: finalName,
                shortName: itemData.ingredient.shortName ?? null,
                description: itemData.ingredient.description ?? null,
                notes: itemData.ingredient.notes ?? null,
                price: itemData.ingredient.price ?? null,
                link: itemData.ingredient.link ?? null,
                tags: itemData.ingredient.tags ?? [],
                workspaceId,
              },
            });

            await createImportVolumes(tx, created.id, workspaceId, itemData);

            const fullCreated = await tx.ingredient.findUnique({
              where: { id: created.id },
              include: { IngredientImage: true, IngredientVolume: { include: { unit: true } } },
            });

            await createLog(tx, workspaceId, user.id, 'Ingredient', created.id, 'CREATE', null, fullCreated);
            results.push({ name: finalName, status: 'created' });
          }
        } catch (err: unknown) {
          results.push({ name: finalName, status: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
        }
      }
    });

    return { success: true, results };
  }

  throw new ApiError(400, 'INVALID_PHASE', 'Invalid phase');
}

export async function getIngredientImage(workspace: Workspace, ingredientId: string): Promise<{ contentType: string; bytes: Buffer } | null> {
  const result = await prisma.ingredientImage.findFirst({
    where: { ingredientId, ingredient: { workspaceId: workspace.id } },
    select: { image: true },
  });

  if (!result?.image) return null;

  const contentType = result.image.split(';')[0].split(':')[1];
  const decoded = result.image.split(',')[1];
  return { contentType, bytes: Buffer.from(decoded, 'base64') };
}
