/**
 * Support writes of the instance API (capability `support.write`, master key only): ownership transfer, session
 * revocation and workspace deletion for the control plane. Instance-wide by design. Every write goes through
 * `runControlPlaneWrite` (audit entry with actor and reason, `Idempotency-Key`). See docs/INSTANCE-API.md.
 */
import type { IncomingHttpHeaders } from 'node:http';
import { Role } from '@generated/prisma/client';
import { ApiError } from '@lib/http/ApiError';
import { MASTER_API_KEY_USER_ID } from '@lib/http/requestAuth';
import { createLog } from '@lib/auditLog';
import { runControlPlaneWrite } from '@lib/instance/controlPlaneWrite';
import { deleteWorkspaceInTx } from '@lib/api/controllers/workspace';
import type { InstanceTransferOwnershipInput } from '@lib/schemas/instanceSupport';

/**
 * Makes a member the only owner; every other owner becomes ADMIN. Serializable, like the other owner changes, so
 * concurrent role changes cannot leave the workspace without an owner.
 */
export function transferOwnership(headers: IncomingHttpHeaders, workspaceId: string, input: InstanceTransferOwnershipInput): Promise<{ ownerId: string }> {
  return runControlPlaneWrite({
    headers,
    action: 'workspace.transferOwnership',
    target: { type: 'workspace', id: workspaceId },
    payload: input,
    isolationLevel: 'Serializable',
    apply: async (tx, { actor, reason }) => {
      const workspace = await tx.workspace.findUnique({ where: { id: workspaceId }, select: { id: true } });
      if (!workspace) throw new ApiError(404, 'NOT_FOUND', 'Workspace not found');
      const target = await tx.workspaceUser.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: input.userId } },
        select: { role: true },
      });
      if (!target) throw new ApiError(404, 'NOT_FOUND', 'User is not a member of the workspace');

      // The workspace audit log shows who at the hosting provider changed the roles, and why.
      const controlPlane = { actor, reason };
      const previousOwners = await tx.workspaceUser.findMany({
        where: { workspaceId, role: Role.OWNER, userId: { not: input.userId } },
        select: { userId: true },
        orderBy: { userId: 'asc' },
      });

      if (target.role !== Role.OWNER) {
        await tx.workspaceUser.update({ where: { workspaceId_userId: { workspaceId, userId: input.userId } }, data: { role: Role.OWNER } });
        await createLog(
          tx,
          workspaceId,
          MASTER_API_KEY_USER_ID,
          'WorkspaceUser',
          input.userId,
          'UPDATE',
          { userId: input.userId, role: target.role },
          { userId: input.userId, role: Role.OWNER, controlPlane },
        );
      }
      for (const { userId } of previousOwners) {
        await tx.workspaceUser.update({ where: { workspaceId_userId: { workspaceId, userId } }, data: { role: Role.ADMIN } });
        await createLog(
          tx,
          workspaceId,
          MASTER_API_KEY_USER_ID,
          'WorkspaceUser',
          userId,
          'UPDATE',
          { userId, role: Role.OWNER },
          { userId, role: Role.ADMIN, controlPlane },
        );
      }

      return {
        response: { ownerId: input.userId },
        details: { previousRole: target.role, previousOwnerIds: previousOwners.map((owner) => owner.userId) },
      };
    },
  });
}

/** Deletes every session of the user. `revoked` counts the ones that had not expired. */
export function revokeUserSessions(headers: IncomingHttpHeaders, userId: string): Promise<{ revoked: number }> {
  return runControlPlaneWrite({
    headers,
    action: 'user.revokeSessions',
    target: { type: 'user', id: userId },
    apply: async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (!user) throw new ApiError(404, 'NOT_FOUND', 'User not found');
      const revoked = await tx.session.count({ where: { userId, expiresAt: { gt: new Date() } } });
      const { count } = await tx.session.deleteMany({ where: { userId } });
      return { response: { revoked }, details: { deletedSessions: count } };
    },
  });
}

/** Same effect as an owner deleting the workspace; template workspaces are refused (409 `TEMPLATE_IN_USE`). */
export function deleteInstanceWorkspace(headers: IncomingHttpHeaders, workspaceId: string): Promise<{ deleted: true }> {
  return runControlPlaneWrite({
    headers,
    action: 'workspace.delete',
    target: { type: 'workspace', id: workspaceId },
    apply: async (tx) => {
      const workspace = await tx.workspace.findUnique({
        where: { id: workspaceId },
        select: { name: true, isDemo: true, users: { select: { userId: true, role: true }, orderBy: { userId: 'asc' } } },
      });
      if (!workspace) throw new ApiError(404, 'NOT_FOUND', 'Workspace not found');
      await deleteWorkspaceInTx(tx, workspaceId);
      // The workspace audit log is deleted with the workspace, so the entry keeps what identifies it.
      return {
        response: { deleted: true as const },
        details: {
          name: workspace.name,
          isDemo: workspace.isDemo,
          memberCount: workspace.users.length,
          ownerIds: workspace.users.filter((member) => member.role === Role.OWNER).map((member) => member.userId),
        },
      };
    },
  });
}
