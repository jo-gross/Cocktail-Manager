/**
 * Version-agnostic business logic for glasses (v1). Same DB operations as the
 * legacy handlers, but returns clean public DTOs (lib/api/dto/glasses.ts).
 * Legacy routes remain wrapped-but-untouched and keep their raw Prisma shapes.
 */
import prisma from '../../../prisma/prisma';
import { createLog } from '@lib/auditLog';
import { calculateGlassSimilarity } from '@lib/findSimilarEntities';
import { ApiError } from '@lib/http/ApiError';
import { toGlassDto } from '@lib/api/dto/glasses';
import packageJson from '../../../package.json';
import type { GlassExportStructure } from '@lib/auditExport';
import type { Prisma, User, Workspace } from '@generated/prisma/client';
import type { GlassCreateInput, GlassDto, GlassUpdateInput } from '@lib/schemas/glasses';

const includeImageCount = { _count: { select: { GlassImage: true } } } satisfies Prisma.GlassInclude;

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
  const createdGlass = await prisma.$transaction(async (tx) => {
    const created = await tx.glass.create({
      data: {
        id: input.id,
        name: input.name,
        volume: input.volume ?? undefined,
        deposit: input.deposit,
        workspace: { connect: { id: workspace.id } },
      },
    });

    if (input.image) {
      await tx.glassImage.create({ data: { image: input.image, glass: { connect: { id: created.id } } } });
    }

    const fullGlass = await tx.glass.findUnique({ where: { id: created.id }, include: { GlassImage: true } });
    await createLog(tx, workspace.id, user.id, 'Glass', created.id, 'CREATE', null, fullGlass);
    return created;
  });

  return toGlassDto(createdGlass, Boolean(input.image), workspace.id);
}

export async function updateGlass(workspace: Workspace, user: User, glassId: string, input: GlassUpdateInput): Promise<GlassDto> {
  const updatedGlass = await prisma.$transaction(async (tx) => {
    const oldGlass = await tx.glass.findUnique({ where: { id: glassId }, include: { GlassImage: true } });

    const updated = await tx.glass.update({
      where: { id: glassId },
      data: {
        id: glassId,
        name: input.name,
        volume: input.volume ?? undefined,
        deposit: input.deposit,
        workspace: { connect: { id: workspace.id } },
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
  const cocktails = await prisma.cocktailRecipe.findMany({
    where: { glassId, workspaceId: workspace.id },
    select: { id: true, name: true },
  });

  if (cocktails.length > 0) {
    throw new ApiError(409, 'GLASS_IN_USE', `Das Glas wird noch in ${cocktails.length} Cocktail(s) verwendet und kann nicht gelöscht werden.`, { cocktails });
  }

  await prisma.$transaction(async (tx) => {
    const oldGlass = await tx.glass.findUnique({ where: { id: glassId }, include: { GlassImage: true } });
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

export async function cloneGlass(workspace: Workspace, glassId: string, name: string): Promise<GlassDto> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.glass.findFirst({
      where: { id: glassId, workspaceId: workspace.id },
      include: { GlassImage: { select: { image: true } } },
    });

    if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Glass not found');

    const createClone = await tx.glass.create({
      data: {
        name,
        deposit: existing.deposit,
        volume: existing.volume,
        workspace: { connect: { id: workspace.id } },
      },
    });

    const hasImage = Boolean(existing.GlassImage && existing.GlassImage.length > 0);
    if (hasImage) {
      await tx.glassImage.create({ data: { glassId: createClone.id, image: existing.GlassImage[0].image } });
    }

    return toGlassDto(createClone, hasImage, workspace.id);
  });
}

export async function getGlassReferences(workspace: Workspace, glassId: string): Promise<Array<{ id: string; name: string }>> {
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

  if (glasses.length === 0) throw new ApiError(404, 'NOT_FOUND', 'Keine Gläser gefunden');

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

interface GlassImportDecision {
  exportName: string;
  decision: 'import' | 'overwrite' | 'rename' | 'skip';
  existingId?: string;
  newName?: string;
  data: GlassExportStructure;
}

/**
 * Faithful replica of the legacy import three-phase flow. Returns the exact
 * legacy payloads per phase, sent verbatim by the route (not { data }-enveloped).
 */
export async function importGlassesJson(
  workspace: Workspace,
  user: User,
  body: { phase: 'validate' | 'prepare-mapping' | 'execute'; exportData: GlassExportStructure | GlassExportStructure[]; decisions?: GlassImportDecision[] },
): Promise<unknown> {
  const workspaceId = workspace.id;
  const items: GlassExportStructure[] = Array.isArray(body.exportData) ? body.exportData : [body.exportData];

  if (body.phase === 'validate') {
    const entities = items.map((item) => {
      if (!item?.glass?.name) return { name: 'Unbekannt', valid: false };
      return { name: item.glass.name, valid: true };
    });
    return { valid: entities.every((e) => e.valid), entities };
  }

  if (body.phase === 'prepare-mapping') {
    const existingGlasses = await prisma.glass.findMany({ where: { workspaceId }, select: { id: true, name: true } });
    const entities = items.map((item) => {
      const name = item.glass?.name || 'Unbekannt';
      const conflicts = existingGlasses.filter((e) => e.name.toLowerCase() === name.toLowerCase());
      return { name, data: item, conflicts: conflicts.map((c) => ({ id: c.id, name: c.name })) };
    });
    return { entities };
  }

  if (body.phase === 'execute') {
    const decisions = body.decisions;
    if (!decisions || decisions.length === 0) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Keine Entscheidungen angegeben');
    }

    const results: Array<{ name: string; status: string; message?: string }> = [];

    await prisma.$transaction(async (tx) => {
      for (const decision of decisions) {
        if (decision.decision === 'skip') {
          results.push({ name: decision.exportName, status: 'skipped' });
          continue;
        }

        const itemData = decision.data;
        if (!itemData?.glass) continue;

        const finalName = decision.decision === 'rename' && decision.newName ? decision.newName : itemData.glass.name;

        try {
          if (decision.decision === 'overwrite' && decision.existingId) {
            const oldData = await tx.glass.findUnique({ where: { id: decision.existingId }, include: { GlassImage: true } });
            const updated = await tx.glass.update({
              where: { id: decision.existingId },
              data: {
                name: finalName,
                notes: itemData.glass.notes ?? null,
                volume: itemData.glass.volume ?? null,
                deposit: itemData.glass.deposit ?? 0,
              },
              include: { GlassImage: true },
            });
            await createLog(tx, workspaceId, user.id, 'Glass', decision.existingId, 'UPDATE', oldData, updated);
            results.push({ name: finalName, status: 'overwritten' });
          } else {
            const created = await tx.glass.create({
              data: {
                name: finalName,
                notes: itemData.glass.notes ?? null,
                volume: itemData.glass.volume ?? null,
                deposit: itemData.glass.deposit ?? 0,
                workspaceId,
              },
              include: { GlassImage: true },
            });
            await createLog(tx, workspaceId, user.id, 'Glass', created.id, 'CREATE', null, created);
            results.push({ name: finalName, status: 'created' });
          }
        } catch (err: unknown) {
          results.push({ name: finalName, status: 'error', message: err instanceof Error ? err.message : 'Unbekannter Fehler' });
        }
      }
    });

    return { success: true, results };
  }

  throw new ApiError(400, 'VALIDATION_ERROR', 'Ungültige Phase');
}

export async function getGlassImage(workspace: Workspace, glassId: string): Promise<{ contentType: string; bytes: Buffer } | null> {
  const result = await prisma.glassImage.findFirst({
    where: { glassId, glass: { workspaceId: workspace.id } },
    select: { image: true },
  });

  if (!result?.image) return null;

  const contentType = result.image.split(';')[0].split(':')[1];
  const decoded = result.image.split(',')[1];
  return { contentType, bytes: Buffer.from(decoded, 'base64') };
}
