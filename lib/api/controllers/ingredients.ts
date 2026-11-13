/**
 * Version-agnostic business logic for ingredients (v1). Returns clean public DTOs
 * (lib/api/dto/ingredients.ts). Every path/body id is scoped to the caller's workspace.
 */
import prisma from '../../../prisma/prisma';
import { createLog } from '@lib/auditLog';
import { calculateIngredientSimilarity } from '@lib/findSimilarEntities';
import levenshtein from 'js-levenshtein';
import { ApiError } from '@lib/http/ApiError';
import { assertIdsInWorkspace, assertInWorkspace } from '@lib/api/scope';
import { BULK_TX_TIMEOUT_MS, runTx, type Db, type Tx } from '@lib/db/tx';
import { decodeStoredImage, type DecodedImage } from '@lib/images/imageResponse';
import { toIngredientDto } from '@lib/api/dto/ingredients';
import { ingredientGuestInfoImportData } from '@lib/guest-info/sanitize';
import packageJson from '../../../package.json';
import type { IngredientExportStructure } from '@lib/auditExport';
import type { Allergen, AllergenSource, Prisma, User, Workspace } from '@generated/prisma/client';
import { nextAllergenSources } from '@lib/guest-info/constants';
import { IngredientExportItemSchema } from '@lib/schemas/ingredients';
import type { IngredientCreateInput, IngredientDto, IngredientExportItem, IngredientImportJsonBody, IngredientUpdateInput } from '@lib/schemas/ingredients';

const ingredientInclude = {
  IngredientVolume: { include: { unit: true } },
  _count: { select: { IngredientImage: true } },
} satisfies Prisma.IngredientInclude;

const auditInclude = { IngredientVolume: { include: { unit: true } }, IngredientImage: true } satisfies Prisma.IngredientInclude;

/** Guest-info fields of a create/update input; omitted fields stay unchanged, a blank guest name is stored as null. */
function guestInfoData(input: IngredientCreateInput | IngredientUpdateInput, existing?: { allergens: Allergen[]; allergenSources: AllergenSource[] } | null) {
  return {
    abv: input.abv,
    allergens: input.allergens,
    allergenSources: nextAllergenSources(input, existing),
    additives: input.additives,
    guestInfoComplete: input.guestInfoComplete,
    hideOnGuestMenu: input.hideOnGuestMenu,
    guestName: input.guestName === undefined ? undefined : input.guestName?.trim() || null,
  };
}

/**
 * Locks the ingredient row for the rest of the transaction and proves it belongs
 * to the workspace (404 otherwise). The row lock also blocks concurrent inserts
 * of recipe lines referencing the ingredient (FK checks take a KEY SHARE lock on it).
 */
async function lockIngredient(tx: Tx, workspaceId: string, ingredientId: string): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "Ingredient" WHERE id = ${ingredientId} AND "workspaceId" = ${workspaceId} FOR UPDATE`;
  if (rows.length === 0) throw new ApiError(404, 'NOT_FOUND', 'Ingredient not found');
}

/** Cocktails of the workspace whose recipe uses the ingredient. */
async function findReferencingCocktails(db: Db, workspaceId: string, ingredientId: string): Promise<Array<{ id: string; name: string }>> {
  return db.cocktailRecipe.findMany({
    where: { workspaceId, steps: { some: { ingredients: { some: { ingredientId } } } } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
}

async function createVolumes(tx: Tx, workspaceId: string, ingredientId: string, units: Array<{ unitId: string; volume: number }>) {
  for (const unit of units) {
    await tx.ingredientVolume.create({ data: { volume: unit.volume, unitId: unit.unitId, ingredientId, workspaceId } });
  }
}

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
  const created = await runTx(async (tx) => {
    await assertIdsInWorkspace(tx, workspace.id, { unit: input.units?.map((unit) => unit.unitId) ?? [] });

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
        ...guestInfoData(input),
        workspaceId: workspace.id,
      },
    });

    if (input.units) {
      await createVolumes(tx, workspace.id, result.id, input.units);
    }

    if (input.image) {
      await tx.ingredientImage.create({ data: { image: input.image, ingredientId: result.id } });
    }

    const fullIngredient = await tx.ingredient.findUniqueOrThrow({ where: { id: result.id }, include: ingredientInclude });
    await createLog(tx, workspace.id, user.id, 'Ingredient', result.id, 'CREATE', null, fullIngredient);
    return fullIngredient;
  });

  return toIngredientDto(created, Boolean(input.image), workspace.id);
}

export async function updateIngredient(workspace: Workspace, user: User, ingredientId: string, input: IngredientUpdateInput): Promise<IngredientDto> {
  const updated = await runTx(async (tx) => {
    await lockIngredient(tx, workspace.id, ingredientId);
    await assertIdsInWorkspace(tx, workspace.id, { unit: input.units?.map((unit) => unit.unitId) ?? [] });

    const oldIngredient = await tx.ingredient.findUniqueOrThrow({ where: { id: ingredientId }, include: auditInclude });

    await tx.ingredient.update({
      where: { id: ingredientId, workspaceId: workspace.id },
      data: {
        name: input.name,
        shortName: input.shortName ?? undefined,
        notes: input.notes ?? undefined,
        description: input.description ?? undefined,
        price: input.price ?? undefined,
        link: input.link ?? undefined,
        tags: input.tags ?? undefined,
        ...guestInfoData(input, oldIngredient),
      },
    });

    await tx.ingredientImage.deleteMany({ where: { ingredientId } });
    if (input.image) {
      await tx.ingredientImage.create({ data: { ingredientId, image: input.image } });
    }

    if (input.units) {
      await tx.ingredientVolume.deleteMany({ where: { ingredientId } });
      await createVolumes(tx, workspace.id, ingredientId, input.units);
    }

    const fullNewIngredient = await tx.ingredient.findUniqueOrThrow({ where: { id: ingredientId }, include: ingredientInclude });
    await createLog(tx, workspace.id, user.id, 'Ingredient', ingredientId, 'UPDATE', oldIngredient, fullNewIngredient);
    return fullNewIngredient;
  });

  return toIngredientDto(updated, Boolean(input.image), workspace.id);
}

export async function deleteIngredient(workspace: Workspace, user: User, ingredientId: string): Promise<{ count: number }> {
  await runTx(async (tx) => {
    // Lock first: recipe lines are deleted with the ingredient (onDelete: Cascade), so the
    // in-use check must see every line committed before the delete and block later inserts.
    await lockIngredient(tx, workspace.id, ingredientId);

    const cocktails = await findReferencingCocktails(tx, workspace.id, ingredientId);
    if (cocktails.length > 0) {
      throw new ApiError(409, 'INGREDIENT_IN_USE', `The ingredient is still used in ${cocktails.length} cocktail(s) and cannot be deleted.`, {
        cocktails,
      });
    }

    const oldIngredient = await tx.ingredient.findUniqueOrThrow({ where: { id: ingredientId }, include: auditInclude });
    await tx.ingredient.delete({ where: { id: ingredientId, workspaceId: workspace.id } });
    await createLog(tx, workspace.id, user.id, 'Ingredient', ingredientId, 'DELETE', oldIngredient, null);
  });

  return { count: 1 };
}

export async function checkIngredient(workspace: Workspace, opts: { name?: string; link?: string }): Promise<IngredientDto | null> {
  if (typeof opts.name !== 'string' && typeof opts.link !== 'string') {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid query');
  }
  if (typeof opts.name === 'string' && opts.name.length < 3) return null;

  const allIngredients = await prisma.ingredient.findMany({ where: { workspaceId: workspace.id }, include: ingredientInclude });

  if (typeof opts.name === 'string') {
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

  const link = opts.link!;
  const best = allIngredients
    .filter((ingredient) => ingredient.link != null)
    .find((ingredient) => 1 - levenshtein(ingredient.link!, link) / Math.max(ingredient.link!.length, link.length) > 0.8);
  return best ? toIngredientDto(best, best._count.IngredientImage > 0, workspace.id) : null;
}

export async function cloneIngredient(workspace: Workspace, user: User, ingredientId: string, name: string): Promise<IngredientDto> {
  const created = await runTx(async (tx) => {
    const existing = await tx.ingredient.findFirst({
      where: { id: ingredientId, workspaceId: workspace.id },
      include: {
        IngredientVolume: { where: { unit: { workspaceId: workspace.id } } },
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
        abv: existing.abv,
        allergens: existing.allergens,
        allergenSources: existing.allergenSources,
        additives: existing.additives,
        guestInfoComplete: existing.guestInfoComplete,
        hideOnGuestMenu: existing.hideOnGuestMenu,
        guestName: existing.guestName,
        workspaceId: workspace.id,
      },
    });

    if (existing.IngredientImage.length > 0) {
      await tx.ingredientImage.create({ data: { ingredientId: createClone.id, image: existing.IngredientImage[0].image } });
    }

    await createVolumes(tx, workspace.id, createClone.id, existing.IngredientVolume);

    const auditClone = await tx.ingredient.findUniqueOrThrow({ where: { id: createClone.id }, include: auditInclude });
    await createLog(tx, workspace.id, user.id, 'Ingredient', createClone.id, 'CREATE', null, auditClone);

    return tx.ingredient.findUniqueOrThrow({ where: { id: createClone.id }, include: ingredientInclude });
  });

  return toIngredientDto(created, created._count.IngredientImage > 0, workspace.id);
}

export async function getIngredientReferences(workspace: Workspace, ingredientId: string): Promise<Array<{ id: string; name: string }>> {
  await assertInWorkspace(prisma, 'ingredient', ingredientId, workspace.id);
  return findReferencingCocktails(prisma, workspace.id, ingredientId);
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
        abv: ingredient.abv,
        allergens: ingredient.allergens,
        allergenSources: ingredient.allergenSources,
        additives: ingredient.additives,
        guestInfoComplete: ingredient.guestInfoComplete,
        hideOnGuestMenu: ingredient.hideOnGuestMenu,
        guestName: ingredient.guestName,
        workspaceId: ingredient.workspaceId,
      },
      ingredientVolumes,
      units: Array.from(unitsMap.values()),
    };
  });

  return exportData.length === 1 ? exportData[0] : exportData;
}

interface ImportItemIssue {
  index: number;
  name: string;
  issues: unknown;
}

function exportItemName(item: unknown): string {
  const name = (item as { ingredient?: { name?: unknown } } | null)?.ingredient?.name;
  return typeof name === 'string' && name.length > 0 ? name : 'Unbekannt';
}

function invalidImport(issues: ImportItemIssue[]): ApiError {
  return new ApiError(400, 'INVALID_IMPORT_ITEMS', `${issues.length} import item(s) are invalid; nothing was imported.`, issues);
}

function ingredientImportData(item: IngredientExportItem, name: string) {
  return {
    name,
    shortName: item.ingredient.shortName ?? null,
    description: item.ingredient.description ?? null,
    notes: item.ingredient.notes ?? null,
    price: item.ingredient.price ?? null,
    link: item.ingredient.link ?? null,
    tags: item.ingredient.tags ?? [],
    ...ingredientGuestInfoImportData(item.ingredient),
  };
}

/**
 * Creates the item's volumes; exported units are matched by name in the workspace
 * and created when missing. `unitIdsByName` caches resolved units across items.
 */
async function createImportVolumes(tx: Tx, workspaceId: string, ingredientId: string, item: IngredientExportItem, unitIdsByName: Map<string, string>) {
  const unitNames = new Map((item.units ?? []).map((unit) => [unit.id, unit.name]));
  for (const volume of item.ingredientVolumes ?? []) {
    // Presence is guaranteed by IngredientExportItemSchema.
    const unitName = unitNames.get(volume.unitId)!;
    let unitId = unitIdsByName.get(unitName);
    if (!unitId) {
      const unit = await tx.unit.upsert({
        where: { name_workspaceId: { name: unitName, workspaceId } },
        create: { name: unitName, workspaceId },
        update: {},
        select: { id: true },
      });
      unitId = unit.id;
      unitIdsByName.set(unitName, unitId);
    }
    await tx.ingredientVolume.create({ data: { volume: volume.volume, ingredientId, unitId, workspaceId } });
  }
}

/**
 * Three-phase JSON import. Returns the legacy payloads per phase, sent verbatim
 * by the route (not { data }-enveloped). `execute` is all-or-nothing: every item
 * and every overwrite target is validated before the single write transaction.
 */
export async function importIngredientsJson(workspace: Workspace, user: User, body: IngredientImportJsonBody): Promise<unknown> {
  const workspaceId = workspace.id;
  const items: unknown[] = body.exportData === undefined ? [] : Array.isArray(body.exportData) ? body.exportData : [body.exportData];

  if (body.phase === 'validate') {
    const entities = items.map((item) => {
      const parsed = IngredientExportItemSchema.safeParse(item);
      return parsed.success ? { name: parsed.data.ingredient.name, valid: true } : { name: exportItemName(item), valid: false, issues: parsed.error.issues };
    });
    return { valid: entities.every((e) => e.valid), entities };
  }

  if (body.phase === 'prepare-mapping') {
    const issues: ImportItemIssue[] = [];
    items.forEach((item, index) => {
      const parsed = IngredientExportItemSchema.safeParse(item);
      if (!parsed.success) issues.push({ index, name: exportItemName(item), issues: parsed.error.issues });
    });
    if (issues.length > 0) throw invalidImport(issues);

    const existingIngredients = await prisma.ingredient.findMany({ where: { workspaceId }, select: { id: true, name: true } });
    const entities = items.map((item) => {
      const name = exportItemName(item);
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

    const issues: ImportItemIssue[] = [];
    const plan = decisions.map((decision, index) => {
      if (decision.decision === 'skip') return { decision, item: null };
      const parsed = IngredientExportItemSchema.safeParse(decision.data);
      if (!parsed.success) {
        issues.push({ index, name: decision.exportName ?? exportItemName(decision.data), issues: parsed.error.issues });
        return { decision, item: null };
      }
      if (decision.decision === 'overwrite' && !decision.existingId) {
        issues.push({ index, name: parsed.data.ingredient.name, issues: [{ path: ['existingId'], message: 'existingId is required to overwrite' }] });
      }
      return { decision, item: parsed.data };
    });
    if (issues.length > 0) throw invalidImport(issues);

    const overwriteIds = decisions.filter((d) => d.decision === 'overwrite').map((d) => d.existingId);
    await assertIdsInWorkspace(prisma, workspaceId, { ingredient: overwriteIds });

    const results = await runTx(
      async (tx) => {
        const unitIdsByName = new Map<string, string>();
        const txResults: Array<{ name: string; status: 'created' | 'overwritten' | 'skipped' }> = [];
        for (const { decision, item } of plan) {
          if (!item) {
            txResults.push({ name: decision.exportName ?? exportItemName(decision.data), status: 'skipped' });
            continue;
          }

          const finalName = decision.decision === 'rename' && decision.newName ? decision.newName : item.ingredient.name;

          if (decision.decision === 'overwrite' && decision.existingId) {
            const ingredientId = decision.existingId;
            const oldData = await tx.ingredient.findFirst({ where: { id: ingredientId, workspaceId }, include: auditInclude });
            if (!oldData) throw new ApiError(400, 'INVALID_REFERENCE', 'Referenced records do not exist in this workspace: Ingredient');

            await tx.ingredient.update({ where: { id: ingredientId, workspaceId }, data: ingredientImportData(item, finalName) });
            await tx.ingredientVolume.deleteMany({ where: { ingredientId } });
            await createImportVolumes(tx, workspaceId, ingredientId, item, unitIdsByName);

            const fullUpdated = await tx.ingredient.findUniqueOrThrow({ where: { id: ingredientId }, include: auditInclude });
            await createLog(tx, workspaceId, user.id, 'Ingredient', ingredientId, 'UPDATE', oldData, fullUpdated);
            txResults.push({ name: finalName, status: 'overwritten' });
          } else {
            const created = await tx.ingredient.create({ data: { ...ingredientImportData(item, finalName), workspaceId } });
            await createImportVolumes(tx, workspaceId, created.id, item, unitIdsByName);

            const fullCreated = await tx.ingredient.findUniqueOrThrow({ where: { id: created.id }, include: auditInclude });
            await createLog(tx, workspaceId, user.id, 'Ingredient', created.id, 'CREATE', null, fullCreated);
            txResults.push({ name: finalName, status: 'created' });
          }
        }
        return txResults;
      },
      { timeout: BULK_TX_TIMEOUT_MS },
    );

    return { success: true, results };
  }

  throw new ApiError(400, 'INVALID_PHASE', 'Invalid phase');
}

export async function getIngredientImage(workspace: Workspace, ingredientId: string): Promise<DecodedImage | null> {
  const result = await prisma.ingredientImage.findFirst({
    where: { ingredientId, ingredient: { workspaceId: workspace.id } },
    select: { image: true },
  });

  return decodeStoredImage(result?.image);
}
