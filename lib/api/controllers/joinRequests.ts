/**
 * Version-agnostic business logic for workspace join requests (v1). Same DB operations and
 * notification emails as the legacy handlers, but returns clean DTOs, maps a missing request
 * to 404, and fixes the legacy self-withdraw double-response bug.
 */
import prisma from '../../../prisma/prisma';
import { Role } from '@generated/prisma/client';
import { ApiError } from '@lib/http/ApiError';
import { sendJoinRequestAcceptedToUser, sendJoinRequestRejectedToUser } from '@lib/email/joinRequestNotifications';
import { toJoinRequestDto } from '@lib/api/dto/joinRequests';
import type { User, Workspace } from '@generated/prisma/client';
import type { JoinRequestDto } from '@lib/schemas/joinRequests';

export async function listJoinRequests(workspace: Workspace): Promise<JoinRequestDto[]> {
  const requests = await prisma.workspaceJoinRequest.findMany({ where: { workspaceId: workspace.id }, include: { user: true } });
  return requests.map(toJoinRequestDto);
}

export async function withdrawOwnJoinRequest(workspace: Workspace, user: User): Promise<{ count: number }> {
  const key = { userId_workspaceId: { workspaceId: workspace.id, userId: user.id } };
  const existing = await prisma.workspaceJoinRequest.findUnique({ where: key });
  if (!existing) throw new ApiError(404, 'NOT_FOUND', 'No pending join request');

  await prisma.workspaceJoinRequest.delete({ where: key });
  return { count: 1 };
}

export async function acceptJoinRequest(workspace: Workspace, userId: string): Promise<{ ok: boolean }> {
  const key = { userId_workspaceId: { workspaceId: workspace.id, userId } };
  const existing = await prisma.workspaceJoinRequest.findUnique({ where: key });
  if (!existing) throw new ApiError(404, 'NOT_FOUND', 'No pending join request');

  await prisma.$transaction(async (tx) => {
    await tx.workspaceJoinRequest.delete({ where: key });
    await tx.workspaceUser.create({ data: { userId, workspaceId: workspace.id, role: Role.USER } });
  });
  sendJoinRequestAcceptedToUser(workspace.id, userId).catch((err) => console.error('[accept] Failed to send notification email', err));
  return { ok: true };
}

export async function rejectJoinRequest(workspace: Workspace, userId: string): Promise<{ ok: boolean }> {
  const key = { userId_workspaceId: { workspaceId: workspace.id, userId } };
  const existing = await prisma.workspaceJoinRequest.findUnique({ where: key });
  if (!existing) throw new ApiError(404, 'NOT_FOUND', 'No pending join request');

  await prisma.workspaceJoinRequest.delete({ where: key });
  sendJoinRequestRejectedToUser(workspace.id, userId).catch((err) => console.error('[reject] Failed to send notification email', err));
  return { ok: true };
}
