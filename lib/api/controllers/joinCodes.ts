/**
 * Version-agnostic business logic for workspace join codes (v1). Same DB operations
 * as the legacy handlers, but returns clean DTOs and maps a missing code to 404.
 */
import prisma from '../../../prisma/prisma';
import { ApiError } from '@lib/http/ApiError';
import { toJoinCodeDto } from '@lib/api/dto/joinCodes';
import type { Workspace } from '@generated/prisma/client';
import type { JoinCodeCreateInput, JoinCodeDto } from '@lib/schemas/joinCodes';

export async function listJoinCodes(workspace: Workspace): Promise<JoinCodeDto[]> {
  const codes = await prisma.workspaceJoinCode.findMany({ where: { workspaceId: workspace.id } });
  return codes.map(toJoinCodeDto);
}

export async function createJoinCode(workspace: Workspace, input: JoinCodeCreateInput): Promise<JoinCodeDto> {
  const created = await prisma.workspaceJoinCode.create({
    data: {
      code: input.code,
      expires: input.expires ? new Date(input.expires) : null,
      onlyUseOnce: input.onlyUseOnce ?? false,
      workspaceId: workspace.id,
    },
  });
  return toJoinCodeDto(created);
}

export async function deleteJoinCode(workspace: Workspace, code: string): Promise<{ count: number }> {
  const existing = await prisma.workspaceJoinCode.findUnique({ where: { workspaceId_code: { workspaceId: workspace.id, code } } });
  if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Join code not found');

  await prisma.workspaceJoinCode.delete({ where: { workspaceId_code: { workspaceId: workspace.id, code } } });
  return { count: 1 };
}
