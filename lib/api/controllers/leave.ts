/**
 * Version-agnostic business logic for leaving a workspace (v1). Removes the caller's own
 * `WorkspaceUser` membership. The route is `sessionOnly`, so `user` is always the real
 * logged-in user (never a synthetic API-key user).
 */
import { Role } from '@generated/prisma/client';
import type { User, Workspace } from '@generated/prisma/client';
import { ApiError } from '@lib/http/ApiError';
import { runSerializable } from '@lib/api/controllers/workspaceUsers';
import { createLog } from '@lib/auditLog';

export async function leaveWorkspace(workspace: Workspace, user: User): Promise<{ ok: boolean }> {
  // Serializable: two owners leaving concurrently must not both pass the last-owner check.
  await runSerializable(async (tx) => {
    const membership = await tx.workspaceUser.findUnique({
      where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
      select: { role: true },
    });
    if (!membership) throw new ApiError(404, 'NOT_FOUND', 'You are not a member of this workspace');

    if (membership.role === Role.OWNER) {
      const owners = await tx.workspaceUser.count({ where: { workspaceId: workspace.id, role: Role.OWNER } });
      if (owners <= 1) {
        throw new ApiError(409, 'LAST_OWNER', 'The last owner cannot leave the workspace. Make another member an owner first.');
      }
    }

    await tx.workspaceUser.delete({
      where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
    });
    await createLog(tx, workspace.id, user.id, 'WorkspaceUser', user.id, 'DELETE', { userId: user.id, role: membership.role }, null);
  });
  return { ok: true };
}
