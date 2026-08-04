/**
 * Version-agnostic business logic for leaving a workspace (v1). Removes the caller's own
 * `WorkspaceUser` membership. The route is `sessionOnly`, so `user` is always the real
 * logged-in user (never a synthetic API-key user).
 */
import prisma from '../../../prisma/prisma';
import type { User, Workspace } from '@generated/prisma/client';

export async function leaveWorkspace(workspace: Workspace, user: User): Promise<{ ok: boolean }> {
  await prisma.workspaceUser.delete({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
  });
  return { ok: true };
}
