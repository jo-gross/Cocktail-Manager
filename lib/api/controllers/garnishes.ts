/**
 * Version-agnostic business logic for garnishes (v1). Returns clean public DTOs
 * (lib/api/dto/garnishes.ts). Every path/body id is scoped to the caller's workspace.
 */
import prisma from '../../../prisma/prisma';
import { nextAllergenSources } from '@lib/guest-info/constants';
import { createLog } from '@lib/auditLog';
import { calculateGarnishSimilarity } from '@lib/findSimilarEntities';
import { ApiError } from '@lib/http/ApiError';
import { assertIdsInWorkspace } from '@lib/api/scope';
import { BULK_TX_TIMEOUT_MS, runTx, type Tx } from '@lib/db/tx';
import { decodeStoredImage, type DecodedImage } from '@lib/images/imageResponse';
import { toGarnishDto } from '@lib/api/dto/garnishes';
import { garnishGuestInfoImportData } from '@lib/guest-info/sanitize';
import packageJson from '../../../package.json';
import type { GarnishExportStructure } from '@lib/auditExport';
import type { Prisma, User, Workspace } from '@generated/prisma/client';
import { GarnishExportItemSchema } from '@lib/schemas/garnishes';
import type { GarnishCreateInput, GarnishDto, GarnishExportItem, GarnishImportJsonBody, GarnishUpdateInput } from '@lib/schemas/garnishes';

const includeImageCount = { _count: { select: { GarnishImage: true } } } satisfies Prisma.GarnishInclude;

/** Locks the garnish row for the rest of the transaction and proves it belongs to the workspace (404 otherwise). */
async function lockGarnish(tx: Tx, workspaceId: string, garnishId: string): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "Garnish" WHERE id = ${garnishId} AND "workspaceId" = ${workspaceId} FOR UPDATE`;
  if (rows.length === 0) throw new ApiError(404, 'NOT_FOUND', 'Garnish not found');
}

export async function listGarnishes(workspace: Workspace, opts: { search?: string }): Promise<GarnishDto[]> {
  const where: Prisma.GarnishWhereInput = { workspaceId: workspace.id };
  if (opts.search) {
    where.name = { contains: opts.search, mode: 'insensitive' };
  }
  const garnishes = await prisma.garnish.findMany({ where, include: includeImageCount });
  return garnishes.map((garnish) => toGarnishDto(garnish, garnish._count.GarnishImage > 0, workspace.id));
}

export async function getGarnish(workspace: Workspace, garnishId: string): Promise<GarnishDto | null> {
  const garnish = await prisma.garnish.findUnique({
    where: { id: garnishId, workspaceId: workspace.id },
    include: includeImageCount,
  });
  return garnish ? toGarnishDto(garnish, garnish._count.GarnishImage > 0, workspace.id) : null;
}

export async function createGarnish(workspace: Workspace, user: User, input: GarnishCreateInput): Promise<GarnishDto> {
  const createdGarnish = await runTx(async (tx) => {
    const created = await tx.garnish.create({
      data: {
        id: input.id,
        name: input.name,
        price: input.price ?? undefined,
        description: input.description ?? undefined,
        notes: input.notes ?? undefined,
        allergens: input.allergens,
        allergenSources: nextAllergenSources(input),
        additives: input.additives,
        guestInfoComplete: input.guestInfoComplete,
        workspaceId: workspace.id,
      },
    });

    if (input.image) {
      await tx.garnishImage.create({ data: { image: input.image, garnishId: created.id } });
    }

    const fullGarnish = await tx.garnish.findUnique({ where: { id: created.id }, include: { GarnishImage: true } });
    await createLog(tx, workspace.id, user.id, 'Garnish', created.id, 'CREATE', null, fullGarnish);
    return created;
  });

  return toGarnishDto(createdGarnish, Boolean(input.image), workspace.id);
}

export async function updateGarnish(workspace: Workspace, user: User, garnishId: string, input: GarnishUpdateInput): Promise<GarnishDto> {
  const updatedGarnish = await runTx(async (tx) => {
    await lockGarnish(tx, workspace.id, garnishId);
    const oldGarnish = await tx.garnish.findUniqueOrThrow({ where: { id: garnishId }, include: { GarnishImage: true } });

    const updated = await tx.garnish.update({
      where: { id: garnishId, workspaceId: workspace.id },
      data: {
        name: input.name,
        price: input.price ?? undefined,
        description: input.description ?? undefined,
        notes: input.notes ?? undefined,
        allergens: input.allergens,
        allergenSources: nextAllergenSources(input, oldGarnish),
        additives: input.additives,
        guestInfoComplete: input.guestInfoComplete,
      },
    });

    await tx.garnishImage.deleteMany({ where: { garnishId } });
    if (input.image) {
      await tx.garnishImage.create({ data: { garnishId, image: input.image } });
    }

    const fullNewGarnish = await tx.garnish.findUnique({ where: { id: garnishId }, include: { GarnishImage: true } });
    await createLog(tx, workspace.id, user.id, 'Garnish', garnishId, 'UPDATE', oldGarnish, fullNewGarnish);
    return updated;
  });

  return toGarnishDto(updatedGarnish, Boolean(input.image), workspace.id);
}

/** Deleting a garnish removes it from the cocktails that use it (CocktailRecipeGarnish cascades). */
export async function deleteGarnish(workspace: Workspace, user: User, garnishId: string): Promise<{ count: number }> {
  await runTx(async (tx) => {
    await lockGarnish(tx, workspace.id, garnishId);
    const oldGarnish = await tx.garnish.findUniqueOrThrow({ where: { id: garnishId }, include: { GarnishImage: true } });
    await tx.garnish.delete({ where: { id: garnishId, workspaceId: workspace.id } });
    await createLog(tx, workspace.id, user.id, 'Garnish', garnishId, 'DELETE', oldGarnish, null);
  });

  return { count: 1 };
}

export async function checkGarnish(workspace: Workspace, name: string): Promise<GarnishDto | null> {
  if (name.length < 3) return null;

  const allGarnishes = await prisma.garnish.findMany({ where: { workspaceId: workspace.id }, include: includeImageCount });

  let best: (typeof allGarnishes)[number] | null = null;
  let maxSimilarity = 0;
  for (const garnish of allGarnishes) {
    const similarity = calculateGarnishSimilarity(name, garnish);
    if (similarity > maxSimilarity) {
      maxSimilarity = similarity;
      best = garnish;
    }
  }

  return best && maxSimilarity > 0.5 ? toGarnishDto(best, best._count.GarnishImage > 0, workspace.id) : null;
}

export async function cloneGarnish(workspace: Workspace, user: User, garnishId: string, name: string): Promise<GarnishDto> {
  return runTx(async (tx) => {
    const existing = await tx.garnish.findFirst({
      where: { id: garnishId, workspaceId: workspace.id },
      include: { GarnishImage: { select: { image: true } } },
    });

    if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Garnish not found');

    const createClone = await tx.garnish.create({
      data: {
        name,
        price: existing.price,
        description: existing.description,
        notes: existing.notes,
        allergens: existing.allergens,
        allergenSources: existing.allergenSources,
        additives: existing.additives,
        guestInfoComplete: existing.guestInfoComplete,
        workspaceId: workspace.id,
      },
    });

    const hasImage = existing.GarnishImage.length > 0;
    if (hasImage) {
      await tx.garnishImage.create({ data: { garnishId: createClone.id, image: existing.GarnishImage[0].image } });
    }

    const fullClone = await tx.garnish.findUnique({ where: { id: createClone.id }, include: { GarnishImage: true } });
    await createLog(tx, workspace.id, user.id, 'Garnish', createClone.id, 'CREATE', null, fullClone);

    return toGarnishDto(createClone, hasImage, workspace.id);
  });
}

/**
 * Exports the given garnishes in the exact legacy export format: a single garnish
 * yields one GarnishExportStructure, multiple garnishes yield an array. Returned
 * verbatim by the route (not { data }-enveloped) so it round-trips with import.
 */
export async function exportGarnishesJson(workspace: Workspace, ids: string[]): Promise<GarnishExportStructure | GarnishExportStructure[]> {
  const garnishes = await prisma.garnish.findMany({ where: { id: { in: ids }, workspaceId: workspace.id } });

  if (garnishes.length === 0) throw new ApiError(404, 'GARNISHES_NOT_FOUND', 'No garnishes found');

  const exportData: GarnishExportStructure[] = garnishes.map((garnish) => ({
    exportVersion: packageJson.version,
    exportDate: new Date().toISOString(),
    garnish: {
      id: garnish.id,
      name: garnish.name,
      description: garnish.description,
      notes: garnish.notes,
      price: garnish.price,
      allergens: garnish.allergens,
      allergenSources: garnish.allergenSources,
      additives: garnish.additives,
      guestInfoComplete: garnish.guestInfoComplete,
      workspaceId: garnish.workspaceId,
    },
  }));

  return exportData.length === 1 ? exportData[0] : exportData;
}

interface ImportItemIssue {
  index: number;
  name: string;
  issues: unknown;
}

function exportItemName(item: unknown): string {
  const name = (item as { garnish?: { name?: unknown } } | null)?.garnish?.name;
  return typeof name === 'string' && name.length > 0 ? name : 'Unbekannt';
}

function invalidImport(issues: ImportItemIssue[]): ApiError {
  return new ApiError(400, 'INVALID_IMPORT_ITEMS', `${issues.length} import item(s) are invalid; nothing was imported.`, issues);
}

function garnishImportData(item: GarnishExportItem, name: string) {
  return {
    name,
    description: item.garnish.description ?? null,
    notes: item.garnish.notes ?? null,
    price: item.garnish.price ?? null,
    ...garnishGuestInfoImportData(item.garnish),
  };
}

/**
 * Three-phase JSON import. Returns the legacy payloads per phase, sent verbatim
 * by the route (not { data }-enveloped). `execute` is all-or-nothing: every item
 * and every overwrite target is validated before the single write transaction.
 */
export async function importGarnishesJson(workspace: Workspace, user: User, body: GarnishImportJsonBody): Promise<unknown> {
  const workspaceId = workspace.id;
  const items: unknown[] = body.exportData === undefined ? [] : Array.isArray(body.exportData) ? body.exportData : [body.exportData];

  if (body.phase === 'validate') {
    const entities = items.map((item) => {
      const parsed = GarnishExportItemSchema.safeParse(item);
      return parsed.success ? { name: parsed.data.garnish.name, valid: true } : { name: exportItemName(item), valid: false, issues: parsed.error.issues };
    });
    return { valid: entities.every((e) => e.valid), entities };
  }

  if (body.phase === 'prepare-mapping') {
    const issues: ImportItemIssue[] = [];
    items.forEach((item, index) => {
      const parsed = GarnishExportItemSchema.safeParse(item);
      if (!parsed.success) issues.push({ index, name: exportItemName(item), issues: parsed.error.issues });
    });
    if (issues.length > 0) throw invalidImport(issues);

    const existingGarnishes = await prisma.garnish.findMany({ where: { workspaceId }, select: { id: true, name: true } });
    const entities = items.map((item) => {
      const name = exportItemName(item);
      const conflicts = existingGarnishes.filter((e) => e.name.toLowerCase() === name.toLowerCase());
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
      const parsed = GarnishExportItemSchema.safeParse(decision.data);
      if (!parsed.success) {
        issues.push({ index, name: decision.exportName ?? exportItemName(decision.data), issues: parsed.error.issues });
        return { decision, item: null };
      }
      if (decision.decision === 'overwrite' && !decision.existingId) {
        issues.push({ index, name: parsed.data.garnish.name, issues: [{ path: ['existingId'], message: 'existingId is required to overwrite' }] });
      }
      return { decision, item: parsed.data };
    });
    if (issues.length > 0) throw invalidImport(issues);

    const overwriteIds = decisions.filter((d) => d.decision === 'overwrite').map((d) => d.existingId);
    await assertIdsInWorkspace(prisma, workspaceId, { garnish: overwriteIds });

    const results = await runTx(
      async (tx) => {
        const txResults: Array<{ name: string; status: 'created' | 'overwritten' | 'skipped' }> = [];
        for (const { decision, item } of plan) {
          if (!item) {
            txResults.push({ name: decision.exportName ?? exportItemName(decision.data), status: 'skipped' });
            continue;
          }

          const finalName = decision.decision === 'rename' && decision.newName ? decision.newName : item.garnish.name;

          if (decision.decision === 'overwrite' && decision.existingId) {
            const oldData = await tx.garnish.findFirst({ where: { id: decision.existingId, workspaceId }, include: { GarnishImage: true } });
            if (!oldData) throw new ApiError(400, 'INVALID_REFERENCE', 'Referenced records do not exist in this workspace: Garnish');
            const updated = await tx.garnish.update({
              where: { id: decision.existingId, workspaceId },
              data: garnishImportData(item, finalName),
              include: { GarnishImage: true },
            });
            await createLog(tx, workspaceId, user.id, 'Garnish', decision.existingId, 'UPDATE', oldData, updated);
            txResults.push({ name: finalName, status: 'overwritten' });
          } else {
            const created = await tx.garnish.create({
              data: { ...garnishImportData(item, finalName), workspaceId },
              include: { GarnishImage: true },
            });
            await createLog(tx, workspaceId, user.id, 'Garnish', created.id, 'CREATE', null, created);
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

export async function getGarnishImage(workspace: Workspace, garnishId: string): Promise<DecodedImage | null> {
  const result = await prisma.garnishImage.findFirst({
    where: { garnishId, garnish: { workspaceId: workspace.id } },
    select: { image: true },
  });

  return decodeStoredImage(result?.image);
}
