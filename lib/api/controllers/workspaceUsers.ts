/**
 * Version-agnostic business logic for workspace users (v1). Same DB operations
 * as the legacy handlers, but returns clean public DTOs
 * (lib/api/dto/workspaceUsers.ts). Legacy routes remain wrapped-but-untouched
 * and keep their raw Prisma shapes.
 */
import prisma from '../../../prisma/prisma';
import { ApiError } from '@lib/http/ApiError';
import { toWorkspaceUserDto } from '@lib/api/dto/workspaceUsers';
import type { User, Workspace } from '@generated/prisma/client';
import type { WorkspaceUserDto, WorkspaceUserUpdateInput } from '@lib/schemas/workspaceUsers';

const includeUser = { user: { select: { name: true, email: true, image: true } } };

export async function listWorkspaceUsers(workspace: Workspace): Promise<WorkspaceUserDto[]> {
  const memberships = await prisma.workspaceUser.findMany({
    where: { workspaceId: workspace.id },
    include: includeUser,
  });
  return memberships.map(toWorkspaceUserDto);
}

export async function updateWorkspaceUser(workspace: Workspace, actor: User, userId: string, input: WorkspaceUserUpdateInput): Promise<WorkspaceUserDto> {
  if (userId === actor.id) {
    throw new ApiError(403, 'FORBIDDEN', 'You cannot change your own role.');
  }

  const existing = await prisma.workspaceUser.findUnique({
    where: { workspaceId_userId: { userId, workspaceId: workspace.id } },
  });
  if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Workspace user not found');

  const updated = await prisma.workspaceUser.update({
    where: { workspaceId_userId: { userId, workspaceId: workspace.id } },
    data: { role: input.role },
    include: includeUser,
  });

  return toWorkspaceUserDto(updated);
}

export async function deleteWorkspaceUser(workspace: Workspace, actor: User, userId: string): Promise<{ count: number }> {
  if (userId === actor.id) {
    throw new ApiError(403, 'FORBIDDEN', 'You cannot remove yourself.');
  }

  const existing = await prisma.workspaceUser.findUnique({
    where: { workspaceId_userId: { userId, workspaceId: workspace.id } },
  });
  if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Workspace user not found');

  await prisma.workspaceUser.delete({
    where: { workspaceId_userId: { userId, workspaceId: workspace.id } },
  });

  return { count: 1 };
}
