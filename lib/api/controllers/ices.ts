/**
 * Version-agnostic business logic for ice (v1). Same DB operations as the legacy
 * handlers, but returns clean public DTOs (lib/api/dto/ices.ts). Legacy routes
 * remain wrapped-but-untouched and keep their raw Prisma shapes.
 */
import prisma from '../../../prisma/prisma';
import { updateTranslation } from '../../../pages/api/workspaces/[workspaceId]/admin/translation';
import { toIceDto } from '@lib/api/dto/ices';
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
  const ice = await prisma.ice.findUnique({
    where: { id: iceId, workspaceId: workspace.id },
  });
  return ice ? toIceDto(ice) : null;
}

export async function createIce(workspace: Workspace, input: IceCreateInput): Promise<IceDto> {
  const created = await prisma.ice.create({
    data: {
      id: input.id,
      name: input.name,
      workspace: { connect: { id: workspace.id } },
    },
  });

  if (input.translations) {
    await updateTranslation(workspace.id, input.name, input.translations);
  }

  return toIceDto(created);
}

export async function updateIce(workspace: Workspace, iceId: string, input: IceUpdateInput): Promise<IceDto> {
  const updated = await prisma.ice.update({
    where: { id: iceId, workspaceId: workspace.id },
    data: { name: input.name },
  });

  if (input.translations) {
    await updateTranslation(workspace.id, input.name, input.translations);
  }

  return toIceDto(updated);
}

export async function deleteIce(workspace: Workspace, iceId: string): Promise<IceDto> {
  const deleted = await prisma.ice.delete({
    where: { id: iceId, workspaceId: workspace.id },
  });
  return toIceDto(deleted);
}
