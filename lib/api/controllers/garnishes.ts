/**
 * Version-agnostic business logic for garnishes (v1). Same DB operations as the
 * legacy handlers, but returns clean public DTOs (lib/api/dto/garnishes.ts).
 * Legacy routes remain wrapped-but-untouched and keep their raw Prisma shapes.
 */
import prisma from '../../../prisma/prisma';
import { createLog } from '@lib/auditLog';
import { calculateGarnishSimilarity } from '@lib/findSimilarEntities';
import { ApiError } from '@lib/http/ApiError';
import { toGarnishDto } from '@lib/api/dto/garnishes';
import packageJson from '../../../package.json';
import type { GarnishExportStructure } from '@lib/auditExport';
import type { Prisma, User, Workspace } from '@generated/prisma/client';
import type { GarnishCreateInput, GarnishDto, GarnishUpdateInput } from '@lib/schemas/garnishes';

const includeImageCount = { _count: { select: { GarnishImage: true } } } satisfies Prisma.GarnishInclude;

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
  const createdGarnish = await prisma.$transaction(async (tx) => {
    const created = await tx.garnish.create({
      data: {
        id: input.id,
        name: input.name,
        price: input.price ?? undefined,
        description: input.description ?? undefined,
        notes: input.notes ?? undefined,
        workspace: { connect: { id: workspace.id } },
      },
    });

    if (input.image) {
      await tx.garnishImage.create({ data: { image: input.image, garnish: { connect: { id: created.id } } } });
    }

    const fullGarnish = await tx.garnish.findUnique({ where: { id: created.id }, include: { GarnishImage: true } });
    await createLog(tx, workspace.id, user.id, 'Garnish', created.id, 'CREATE', null, fullGarnish);
    return created;
  });

  return toGarnishDto(createdGarnish, Boolean(input.image), workspace.id);
}

export async function updateGarnish(workspace: Workspace, user: User, garnishId: string, input: GarnishUpdateInput): Promise<GarnishDto> {
  const updatedGarnish = await prisma.$transaction(async (tx) => {
    const oldGarnish = await tx.garnish.findUnique({ where: { id: garnishId }, include: { GarnishImage: true } });

    const updated = await tx.garnish.update({
      where: { id: garnishId },
      data: {
        name: input.name,
        price: input.price ?? undefined,
        description: input.description ?? undefined,
        notes: input.notes ?? undefined,
        workspace: { connect: { id: workspace.id } },
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

export async function deleteGarnish(workspace: Workspace, user: User, garnishId: string): Promise<{ count: number }> {
  await prisma.$transaction(async (tx) => {
    const oldGarnish = await tx.garnish.findUnique({ where: { id: garnishId }, include: { GarnishImage: true } });
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

export async function cloneGarnish(workspace: Workspace, garnishId: string, name: string): Promise<GarnishDto> {
  return prisma.$transaction(async (tx) => {
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
        workspace: { connect: { id: workspace.id } },
      },
    });

    const hasImage = Boolean(existing.GarnishImage && existing.GarnishImage.length > 0);
    if (hasImage) {
      await tx.garnishImage.create({ data: { garnishId: createClone.id, image: existing.GarnishImage[0].image } });
    }

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

  if (garnishes.length === 0) throw new ApiError(404, 'NOT_FOUND', 'Keine Garnituren gefunden');

  const exportData: GarnishExportStructure[] = garnishes.map((garnish) => ({
    exportVersion: packageJson.version,
    exportDate: new Date().toISOString(),
    garnish: {
      id: garnish.id,
      name: garnish.name,
      description: garnish.description,
      notes: garnish.notes,
      price: garnish.price,
      workspaceId: garnish.workspaceId,
    },
  }));

  return exportData.length === 1 ? exportData[0] : exportData;
}

interface GarnishImportDecision {
  exportName: string;
  decision: 'import' | 'overwrite' | 'rename' | 'skip';
  existingId?: string;
  newName?: string;
  data: GarnishExportStructure;
}

/**
 * Faithful replica of the legacy import three-phase flow. Returns the exact
 * legacy payloads per phase, sent verbatim by the route (not { data }-enveloped).
 */
export async function importGarnishesJson(
  workspace: Workspace,
  user: User,
  body: {
    phase: 'validate' | 'prepare-mapping' | 'execute';
    exportData: GarnishExportStructure | GarnishExportStructure[];
    decisions?: GarnishImportDecision[];
  },
): Promise<unknown> {
  const workspaceId = workspace.id;
  const items: GarnishExportStructure[] = Array.isArray(body.exportData) ? body.exportData : [body.exportData];

  if (body.phase === 'validate') {
    const entities = items.map((item) => {
      if (!item?.garnish?.name) return { name: 'Unbekannt', valid: false };
      return { name: item.garnish.name, valid: true };
    });
    return { valid: entities.every((e) => e.valid), entities };
  }

  if (body.phase === 'prepare-mapping') {
    const existingGarnishes = await prisma.garnish.findMany({ where: { workspaceId }, select: { id: true, name: true } });
    const entities = items.map((item) => {
      const name = item.garnish?.name || 'Unbekannt';
      const conflicts = existingGarnishes.filter((e) => e.name.toLowerCase() === name.toLowerCase());
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
        if (!itemData?.garnish) continue;

        const finalName = decision.decision === 'rename' && decision.newName ? decision.newName : itemData.garnish.name;

        try {
          if (decision.decision === 'overwrite' && decision.existingId) {
            const oldData = await tx.garnish.findUnique({ where: { id: decision.existingId }, include: { GarnishImage: true } });
            const updated = await tx.garnish.update({
              where: { id: decision.existingId },
              data: {
                name: finalName,
                description: itemData.garnish.description ?? null,
                notes: itemData.garnish.notes ?? null,
                price: itemData.garnish.price ?? null,
              },
              include: { GarnishImage: true },
            });
            await createLog(tx, workspaceId, user.id, 'Garnish', decision.existingId, 'UPDATE', oldData, updated);
            results.push({ name: finalName, status: 'overwritten' });
          } else {
            const created = await tx.garnish.create({
              data: {
                name: finalName,
                description: itemData.garnish.description ?? null,
                notes: itemData.garnish.notes ?? null,
                price: itemData.garnish.price ?? null,
                workspaceId,
              },
              include: { GarnishImage: true },
            });
            await createLog(tx, workspaceId, user.id, 'Garnish', created.id, 'CREATE', null, created);
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

export async function getGarnishImage(workspace: Workspace, garnishId: string): Promise<{ contentType: string; bytes: Buffer } | null> {
  const result = await prisma.garnishImage.findFirst({
    where: { garnishId, garnish: { workspaceId: workspace.id } },
    select: { image: true },
  });

  if (!result?.image) return null;

  const contentType = result.image.split(';')[0].split(':')[1];
  const decoded = result.image.split(',')[1];
  return { contentType, bytes: Buffer.from(decoded, 'base64') };
}
