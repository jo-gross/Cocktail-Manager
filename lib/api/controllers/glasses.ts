/**
 * Version-agnostic business logic for glasses (v1). Returns clean public DTOs
 * (lib/api/dto/glasses.ts). Every path/body id is scoped to the caller's workspace.
 */
import prisma from '../../../prisma/prisma';
import { createLog } from '@lib/auditLog';
import { calculateGlassSimilarity } from '@lib/findSimilarEntities';
import { ApiError } from '@lib/http/ApiError';
import { assertIdsInWorkspace, assertInWorkspace } from '@lib/api/scope';
import { BULK_TX_TIMEOUT_MS, runTx, type Tx } from '@lib/db/tx';
import { decodeStoredImage, type DecodedImage } from '@lib/images/imageResponse';
import { toGlassDto } from '@lib/api/dto/glasses';
import packageJson from '../../../package.json';
import type { GlassExportStructure } from '@lib/auditExport';
import type { Prisma, User, Workspace } from '@generated/prisma/client';
import { GlassExportItemSchema } from '@lib/schemas/glasses';
import type { GlassCreateInput, GlassDto, GlassExportItem, GlassImportJsonBody, GlassUpdateInput } from '@lib/schemas/glasses';

const includeImageCount = { _count: { select: { GlassImage: true } } } satisfies Prisma.GlassInclude;

/**
 * Locks the glass row for the rest of the transaction and proves it belongs to
 * the workspace (404 otherwise). The row lock also blocks concurrent inserts of
 * cocktails referencing the glass (FK checks take a KEY SHARE lock on it).
 */
async function lockGlass(tx: Tx, workspaceId: string, glassId: string): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "Glass" WHERE id = ${glassId} AND "workspaceId" = ${workspaceId} FOR UPDATE`;
  if (rows.length === 0) throw new ApiError(404, 'NOT_FOUND', 'Glass not found');
}

export async function listGlasses(workspace: Workspace, opts: { search?: string }): Promise<GlassDto[]> {
  const where: Prisma.GlassWhereInput = { workspaceId: workspace.id };
  if (opts.search) {
    where.name = { contains: opts.search, mode: 'insensitive' };
  }
  const glasses = await prisma.glass.findMany({ where, include: includeImageCount });
  return glasses.map((glass) => toGlassDto(glass, glass._count.GlassImage > 0, workspace.id));
}

export async function getGlass(workspace: Workspace, glassId: string): Promise<GlassDto | null> {
  const glass = await prisma.glass.findUnique({
    where: { id: glassId, workspaceId: workspace.id },
    include: includeImageCount,
  });
  return glass ? toGlassDto(glass, glass._count.GlassImage > 0, workspace.id) : null;
}

export async function createGlass(workspace: Workspace, user: User, input: GlassCreateInput): Promise<GlassDto> {
  const createdGlass = await runTx(async (tx) => {
    const created = await tx.glass.create({
      data: {
        id: input.id,
        name: input.name,
        volume: input.volume ?? undefined,
        deposit: input.deposit,
        workspaceId: workspace.id,
      },
    });

    if (input.image) {
      await tx.glassImage.create({ data: { image: input.image, glassId: created.id } });
    }

    const fullGlass = await tx.glass.findUnique({ where: { id: created.id }, include: { GlassImage: true } });
    await createLog(tx, workspace.id, user.id, 'Glass', created.id, 'CREATE', null, fullGlass);
    return created;
  });

  return toGlassDto(createdGlass, Boolean(input.image), workspace.id);
}

export async function updateGlass(workspace: Workspace, user: User, glassId: string, input: GlassUpdateInput): Promise<GlassDto> {
  const updatedGlass = await runTx(async (tx) => {
    await lockGlass(tx, workspace.id, glassId);
    const oldGlass = await tx.glass.findUniqueOrThrow({ where: { id: glassId }, include: { GlassImage: true } });

    const updated = await tx.glass.update({
      where: { id: glassId, workspaceId: workspace.id },
      data: {
        name: input.name,
        volume: input.volume ?? undefined,
        deposit: input.deposit,
      },
    });

    await tx.glassImage.deleteMany({ where: { glassId } });
    if (input.image) {
      await tx.glassImage.create({ data: { glassId, image: input.image } });
    }

    const fullNewGlass = await tx.glass.findUnique({ where: { id: glassId }, include: { GlassImage: true } });
    await createLog(tx, workspace.id, user.id, 'Glass', glassId, 'UPDATE', oldGlass, fullNewGlass);
    return updated;
  });

  return toGlassDto(updatedGlass, Boolean(input.image), workspace.id);
}

export async function deleteGlass(workspace: Workspace, user: User, glassId: string): Promise<{ count: number }> {
  await runTx(async (tx) => {
    // Lock first: a cocktail saved concurrently either commits before (→ 409 below) or fails its FK check afterwards.
    await lockGlass(tx, workspace.id, glassId);

    const cocktails = await tx.cocktailRecipe.findMany({
      where: { glassId, workspaceId: workspace.id },
      select: { id: true, name: true },
    });
    if (cocktails.length > 0) {
      throw new ApiError(409, 'GLASS_IN_USE', `The glass is still used in ${cocktails.length} cocktail(s) and cannot be deleted.`, { cocktails });
    }

    const oldGlass = await tx.glass.findUniqueOrThrow({ where: { id: glassId }, include: { GlassImage: true } });
    await tx.glass.delete({ where: { id: glassId, workspaceId: workspace.id } });
    await createLog(tx, workspace.id, user.id, 'Glass', glassId, 'DELETE', oldGlass, null);
  });

  return { count: 1 };
}

export async function checkGlass(workspace: Workspace, name: string): Promise<GlassDto | null> {
  if (name.length < 3) return null;

  const allGlasses = await prisma.glass.findMany({ where: { workspaceId: workspace.id }, include: includeImageCount });

  let best: (typeof allGlasses)[number] | null = null;
  let maxSimilarity = 0;
  for (const glass of allGlasses) {
    const similarity = calculateGlassSimilarity(name, glass);
    if (similarity > maxSimilarity) {
      maxSimilarity = similarity;
      best = glass;
    }
  }

  return best && maxSimilarity > 0.5 ? toGlassDto(best, best._count.GlassImage > 0, workspace.id) : null;
}

export async function cloneGlass(workspace: Workspace, user: User, glassId: string, name: string): Promise<GlassDto> {
  return runTx(async (tx) => {
    const existing = await tx.glass.findFirst({
      where: { id: glassId, workspaceId: workspace.id },
      include: { GlassImage: { select: { image: true } } },
    });

    if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Glass not found');

    const createClone = await tx.glass.create({
      data: {
        name,
        notes: existing.notes,
        deposit: existing.deposit,
        volume: existing.volume,
        workspaceId: workspace.id,
      },
    });

    const hasImage = existing.GlassImage.length > 0;
    if (hasImage) {
      await tx.glassImage.create({ data: { glassId: createClone.id, image: existing.GlassImage[0].image } });
    }

    const fullClone = await tx.glass.findUnique({ where: { id: createClone.id }, include: { GlassImage: true } });
    await createLog(tx, workspace.id, user.id, 'Glass', createClone.id, 'CREATE', null, fullClone);

    return toGlassDto(createClone, hasImage, workspace.id);
  });
}

export async function getGlassReferences(workspace: Workspace, glassId: string): Promise<Array<{ id: string; name: string }>> {
  await assertInWorkspace(prisma, 'glass', glassId, workspace.id);
  return prisma.cocktailRecipe.findMany({
    where: { glassId, workspaceId: workspace.id },
    select: { id: true, name: true },
  });
}

/**
 * Exports the given glasses in the exact legacy export format: a single glass
 * yields one GlassExportStructure, multiple glasses yield an array. Returned
 * verbatim by the route (not { data }-enveloped) so it round-trips with import.
 */
export async function exportGlassesJson(workspace: Workspace, ids: string[]): Promise<GlassExportStructure | GlassExportStructure[]> {
  const glasses = await prisma.glass.findMany({ where: { id: { in: ids }, workspaceId: workspace.id } });

  if (glasses.length === 0) throw new ApiError(404, 'GLASSES_NOT_FOUND', 'No glasses found');

  const exportData: GlassExportStructure[] = glasses.map((glass) => ({
    exportVersion: packageJson.version,
    exportDate: new Date().toISOString(),
    glass: {
      id: glass.id,
      name: glass.name,
      notes: glass.notes,
      volume: glass.volume,
      deposit: glass.deposit,
      workspaceId: glass.workspaceId,
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
  const name = (item as { glass?: { name?: unknown } } | null)?.glass?.name;
  return typeof name === 'string' && name.length > 0 ? name : 'Unbekannt';
}

function invalidImport(issues: ImportItemIssue[]): ApiError {
  return new ApiError(400, 'INVALID_IMPORT_ITEMS', `${issues.length} import item(s) are invalid; nothing was imported.`, issues);
}

function glassImportData(item: GlassExportItem, name: string) {
  return {
    name,
    notes: item.glass.notes ?? null,
    volume: item.glass.volume ?? null,
    deposit: item.glass.deposit ?? 0,
  };
}

/**
 * Three-phase JSON import. Returns the legacy payloads per phase, sent verbatim
 * by the route (not { data }-enveloped). `execute` is all-or-nothing: every item
 * and every overwrite target is validated before the single write transaction.
 */
export async function importGlassesJson(workspace: Workspace, user: User, body: GlassImportJsonBody): Promise<unknown> {
  const workspaceId = workspace.id;
  const items: unknown[] = body.exportData === undefined ? [] : Array.isArray(body.exportData) ? body.exportData : [body.exportData];

  if (body.phase === 'validate') {
    const entities = items.map((item) => {
      const parsed = GlassExportItemSchema.safeParse(item);
      return parsed.success ? { name: parsed.data.glass.name, valid: true } : { name: exportItemName(item), valid: false, issues: parsed.error.issues };
    });
    return { valid: entities.every((e) => e.valid), entities };
  }

  if (body.phase === 'prepare-mapping') {
    const issues: ImportItemIssue[] = [];
    items.forEach((item, index) => {
      const parsed = GlassExportItemSchema.safeParse(item);
      if (!parsed.success) issues.push({ index, name: exportItemName(item), issues: parsed.error.issues });
    });
    if (issues.length > 0) throw invalidImport(issues);

    const existingGlasses = await prisma.glass.findMany({ where: { workspaceId }, select: { id: true, name: true } });
    const entities = items.map((item) => {
      const name = exportItemName(item);
      const conflicts = existingGlasses.filter((e) => e.name.toLowerCase() === name.toLowerCase());
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
      const parsed = GlassExportItemSchema.safeParse(decision.data);
      if (!parsed.success) {
        issues.push({ index, name: decision.exportName ?? exportItemName(decision.data), issues: parsed.error.issues });
        return { decision, item: null };
      }
      if (decision.decision === 'overwrite' && !decision.existingId) {
        issues.push({ index, name: parsed.data.glass.name, issues: [{ path: ['existingId'], message: 'existingId is required to overwrite' }] });
      }
      return { decision, item: parsed.data };
    });
    if (issues.length > 0) throw invalidImport(issues);

    const overwriteIds = decisions.filter((d) => d.decision === 'overwrite').map((d) => d.existingId);
    await assertIdsInWorkspace(prisma, workspaceId, { glass: overwriteIds });

    const results = await runTx(
      async (tx) => {
        const txResults: Array<{ name: string; status: 'created' | 'overwritten' | 'skipped' }> = [];
        for (const { decision, item } of plan) {
          if (!item) {
            txResults.push({ name: decision.exportName ?? exportItemName(decision.data), status: 'skipped' });
            continue;
          }

          const finalName = decision.decision === 'rename' && decision.newName ? decision.newName : item.glass.name;

          if (decision.decision === 'overwrite' && decision.existingId) {
            const oldData = await tx.glass.findFirst({ where: { id: decision.existingId, workspaceId }, include: { GlassImage: true } });
            if (!oldData) throw new ApiError(400, 'INVALID_REFERENCE', 'Referenced records do not exist in this workspace: Glass');
            const updated = await tx.glass.update({
              where: { id: decision.existingId, workspaceId },
              data: glassImportData(item, finalName),
              include: { GlassImage: true },
            });
            await createLog(tx, workspaceId, user.id, 'Glass', decision.existingId, 'UPDATE', oldData, updated);
            txResults.push({ name: finalName, status: 'overwritten' });
          } else {
            const created = await tx.glass.create({
              data: { ...glassImportData(item, finalName), workspaceId },
              include: { GlassImage: true },
            });
            await createLog(tx, workspaceId, user.id, 'Glass', created.id, 'CREATE', null, created);
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

export async function getGlassImage(workspace: Workspace, glassId: string): Promise<DecodedImage | null> {
  const result = await prisma.glassImage.findFirst({
    where: { glassId, glass: { workspaceId: workspace.id } },
    select: { image: true },
  });

  return decodeStoredImage(result?.image);
}
