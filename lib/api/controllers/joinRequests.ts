/**
 * Version-agnostic business logic for workspace join requests (v1). Returns clean DTOs, maps a
 * missing request to 404 and sends notification emails after the change is committed.
 */
import prisma from '../../../prisma/prisma';
import { Role } from '@generated/prisma/client';
import { ApiError } from '@lib/http/ApiError';
import { runTx, type Db } from '@lib/db/tx';
import { createLog } from '@lib/auditLog';
import { sendJoinRequestAcceptedToUser, sendJoinRequestRejectedToUser } from '@lib/email/joinRequestNotifications';
import { toJoinRequestDto } from '@lib/api/dto/joinRequests';
import type { User, Workspace } from '@generated/prisma/client';
import type { JoinRequestDto } from '@lib/schemas/joinRequests';

const noPendingRequest = () => new ApiError(404, 'NOT_FOUND', 'No pending join request');

export async function listJoinRequests(workspace: Workspace): Promise<JoinRequestDto[]> {
  const requests = await prisma.workspaceJoinRequest.findMany({
    where: { workspaceId: workspace.id },
    include: { user: { select: { id: true, name: true, email: true, image: true } } },
  });
  return requests.map(toJoinRequestDto);
}

/** Deletes the request of `userId` in the workspace; the count check makes concurrent calls a clean 404. */
async function consumeJoinRequest(db: Db, workspaceId: string, userId: string): Promise<void> {
  const { count } = await db.workspaceJoinRequest.deleteMany({ where: { workspaceId, userId } });
  if (count === 0) throw noPendingRequest();
}

/** The caller's own pending request; callers are applicants, not members, so no workspace auth applies. */
export async function withdrawOwnJoinRequest(workspaceId: string, user: User): Promise<{ count: number }> {
  await consumeJoinRequest(prisma, workspaceId, user.id);
  return { count: 1 };
}

export async function acceptJoinRequest(workspace: Workspace, actor: User, userId: string): Promise<{ ok: boolean }> {
  await runTx(async (tx) => {
    // Row-locking delete: a concurrent accept/reject waits and then deletes nothing → 404.
    await consumeJoinRequest(tx, workspace.id, userId);
    const existingMembership = await tx.workspaceUser.findUnique({
      where: { workspaceId_userId: { workspaceId: workspace.id, userId } },
      select: { role: true },
    });
    if (!existingMembership) {
      await tx.workspaceUser.create({ data: { userId, workspaceId: workspace.id, role: Role.USER } });
      await createLog(tx, workspace.id, actor.id, 'WorkspaceUser', userId, 'CREATE', null, { userId, role: Role.USER });
    }
  });
  sendJoinRequestAcceptedToUser(workspace.id, userId).catch((err) => console.error('[accept] Failed to send notification email', err));
  return { ok: true };
}

export async function rejectJoinRequest(workspace: Workspace, userId: string): Promise<{ ok: boolean }> {
  await consumeJoinRequest(prisma, workspace.id, userId);
  sendJoinRequestRejectedToUser(workspace.id, userId).catch((err) => console.error('[reject] Failed to send notification email', err));
  return { ok: true };
}
