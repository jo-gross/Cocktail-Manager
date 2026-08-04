/**
 * Version-agnostic business logic for the workspace resource (v1). Same DB
 * operations as the legacy handlers (pages/api/workspaces/[workspaceId]/index.ts
 * and .../settings/index.ts), but returns clean public DTOs
 * (lib/api/dto/workspace.ts). Legacy routes remain wrapped-but-untouched and keep
 * their raw Prisma shapes.
 */
import prisma from '../../../prisma/prisma';
import { isWorkspaceExternallyManaged } from '@lib/config/externalWorkspace';
import { ApiError } from '@lib/http/ApiError';
import { toWorkspaceDto, toWorkspaceSettingsDto } from '@lib/api/dto/workspace';
import type { User, Workspace } from '@generated/prisma/client';
import type { WorkspaceDto, WorkspaceSettingsDto, WorkspaceSettingUpdateInput, WorkspaceUpdateInput } from '@lib/schemas/workspace';

const memberSelect = {
  role: true,
  lastOpened: true,
  user: { select: { id: true, name: true, email: true, image: true } },
} as const;

async function loadWorkspaceDto(workspaceId: string): Promise<WorkspaceDto> {
  const [full, settings, members] = await Promise.all([
    prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } }),
    prisma.workspaceSetting.findMany({ where: { workspaceId } }),
    prisma.workspaceUser.findMany({ where: { workspaceId }, select: memberSelect }),
  ]);
  return toWorkspaceDto(full, settings, members, isWorkspaceExternallyManaged(workspaceId));
}

/**
 * Faithful replica of the legacy GET: expired demo workspaces are deleted (→410),
 * the caller's `lastOpened` is refreshed, and the workspace is returned with its
 * settings and members.
 */
export async function getWorkspace(workspace: Workspace, user: User): Promise<WorkspaceDto> {
  if (workspace.isDemo && workspace.expiresAt && workspace.expiresAt < new Date()) {
    await prisma.workspace.delete({ where: { id: workspace.id } });
    throw new ApiError(410, 'WORKSPACE_EXPIRED', 'Demo workspace has expired and has been deleted');
  }

  // updateMany (not update) so callers without a membership row — API-key and
  // master-key auth inject a synthetic user whose id is the key id, not a real
  // WorkspaceUser — are a silent no-op instead of a P2025 "record not found".
  await prisma.workspaceUser.updateMany({
    where: { workspaceId: workspace.id, userId: user.id },
    data: { lastOpened: new Date() },
  });

  return loadWorkspaceDto(workspace.id);
}

export async function updateWorkspace(workspace: Workspace, input: WorkspaceUpdateInput): Promise<WorkspaceDto> {
  await prisma.workspace.update({
    where: { id: workspace.id },
    data: { id: workspace.id, name: input.name },
  });

  return loadWorkspaceDto(workspace.id);
}

export async function deleteWorkspace(workspace: Workspace): Promise<{ count: number }> {
  await prisma.workspace.delete({ where: { id: workspace.id } });
  return { count: 1 };
}

export async function getWorkspaceSettings(workspace: Workspace): Promise<WorkspaceSettingsDto> {
  const settings = await prisma.workspaceSetting.findMany({ where: { workspaceId: workspace.id } });
  return toWorkspaceSettingsDto(settings);
}

export async function updateWorkspaceSetting(workspace: Workspace, input: WorkspaceSettingUpdateInput): Promise<WorkspaceSettingsDto> {
  await prisma.workspaceSetting.upsert({
    where: { workspaceId_setting: { workspaceId: workspace.id, setting: input.setting } },
    create: { workspaceId: workspace.id, setting: input.setting, value: input.value ?? null },
    update: { value: input.value ?? null },
  });

  const settings = await prisma.workspaceSetting.findMany({ where: { workspaceId: workspace.id } });
  return toWorkspaceSettingsDto(settings);
}
