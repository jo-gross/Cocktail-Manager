/**
 * Version-agnostic business logic for ice (v1). Returns clean public DTOs
 * (lib/api/dto/ices.ts). Every lookup and write is scoped by `workspaceId`; the
 * entity write and its display-name translation share one transaction.
 */
import prisma from '../../../prisma/prisma';
import { updateTranslation } from '@lib/translations/workspaceTranslations';
import { toIceDto } from '@lib/api/dto/ices';
import { ApiError } from '@lib/http/ApiError';
import { runTx } from '@lib/db/tx';
import type { Prisma, Workspace } from '@generated/prisma/client';
import type { IceCreateInput, IceDto, IceUpdateInput } from '@lib/schemas/ices';

export async function listIces(workspace: Workspace, opts: { search?: string }): Promise<IceDto[]> {
  const where: Prisma.IceWhereInput = { workspaceId: workspace.id };
  if (opts.search) {
    where.name = { contains: opts.search, mode: 'insensitive' };
  }
  const ice = await prisma.ice.findMany({ where });
  return ice.map(toIceDto);
}

export async function getIce(workspace: Workspace, iceId: string): Promise<IceDto | null> {
  const ice = await prisma.ice.findFirst({ where: { id: iceId, workspaceId: workspace.id } });
  return ice ? toIceDto(ice) : null;
}

export async function createIce(workspace: Workspace, input: IceCreateInput): Promise<IceDto> {
  const created = await runTx(async (tx) => {
    const ice = await tx.ice.create({ data: { id: input.id, name: input.name, workspaceId: workspace.id } });
    if (input.translations) await updateTranslation(tx, workspace.id, input.name, input.translations);
    return ice;
  });
  return toIceDto(created);
}

export async function updateIce(workspace: Workspace, iceId: string, input: IceUpdateInput): Promise<IceDto> {
  const updated = await runTx(async (tx) => {
    const existing = await tx.ice.findFirst({ where: { id: iceId, workspaceId: workspace.id }, select: { id: true } });
    if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Ice not found');
    const ice = await tx.ice.update({ where: { id: iceId, workspaceId: workspace.id }, data: { name: input.name } });
    if (input.translations) await updateTranslation(tx, workspace.id, input.name, input.translations);
    return ice;
  });
  return toIceDto(updated);
}

/** Cocktails using the ice keep existing without ice (FK is ON DELETE SET NULL). */
export async function deleteIce(workspace: Workspace, iceId: string): Promise<IceDto> {
  const existing = await prisma.ice.findFirst({ where: { id: iceId, workspaceId: workspace.id } });
  if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Ice not found');
  const deleted = await prisma.ice.delete({ where: { id: iceId, workspaceId: workspace.id } });
  return toIceDto(deleted);
}
