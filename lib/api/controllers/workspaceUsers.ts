/**
 * Version-agnostic business logic for workspace users (v1). Returns clean public
 * DTOs (lib/api/dto/workspaceUsers.ts).
 *
 * Ownership rules (enforced in a Serializable transaction so concurrent changes
 * cannot leave a workspace without an owner):
 * - only an OWNER session user or the instance master key may grant OWNER or
 *   change/remove a member who is an OWNER; workspace API keys never may;
 * - the last OWNER can never be demoted or removed.
 */
import { Role } from '@generated/prisma/client';
import type { User, Workspace } from '@generated/prisma/client';
import prisma from '../../../prisma/prisma';
import { ApiError } from '@lib/http/ApiError';
import { runTx, type Tx } from '@lib/db/tx';
import { createLog } from '@lib/auditLog';
import { toWorkspaceUserDto } from '@lib/api/dto/workspaceUsers';
import type { WorkspaceUserDto, WorkspaceUserUpdateInput } from '@lib/schemas/workspaceUsers';

const includeUser = { user: { select: { name: true, email: true, image: true } } };

/** How the caller authenticated: a member session, a workspace API key or the instance master key. */
export type MembershipActor = { kind: 'session'; user: User } | { kind: 'apiKey'; user: User } | { kind: 'master'; user: User };

/** Serializable transaction; serialization conflicts are retried, then answered with 409 by `runTx`. */
export function runSerializable<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return runTx(fn, { isolationLevel: 'Serializable' });
}

export async function listWorkspaceUsers(workspace: Workspace): Promise<WorkspaceUserDto[]> {
  const memberships = await prisma.workspaceUser.findMany({
    where: { workspaceId: workspace.id },
    include: includeUser,
  });
  return memberships.map(toWorkspaceUserDto);
}

async function mayManageOwners(tx: Tx, workspaceId: string, actor: MembershipActor): Promise<boolean> {
  if (actor.kind === 'master') return true;
  if (actor.kind === 'apiKey') return false;
  const membership = await tx.workspaceUser.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: actor.user.id } },
    select: { role: true },
  });
  return membership?.role === Role.OWNER;
}

async function assertNotLastOwner(tx: Tx, workspaceId: string): Promise<void> {
  const owners = await tx.workspaceUser.count({ where: { workspaceId, role: Role.OWNER } });
  if (owners <= 1) throw new ApiError(409, 'LAST_OWNER', 'The last owner of a workspace cannot be demoted or removed.');
}

export async function updateWorkspaceUser(
  workspace: Workspace,
  actor: MembershipActor,
  userId: string,
  input: WorkspaceUserUpdateInput,
): Promise<WorkspaceUserDto> {
  if (userId === actor.user.id) {
    throw new ApiError(403, 'FORBIDDEN', 'You cannot change your own role.');
  }

  const updated = await runSerializable(async (tx) => {
    const existing = await tx.workspaceUser.findUnique({
      where: { workspaceId_userId: { userId, workspaceId: workspace.id } },
    });
    if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Workspace user not found');

    const touchesOwnership = existing.role === Role.OWNER || input.role === Role.OWNER;
    if (touchesOwnership && !(await mayManageOwners(tx, workspace.id, actor))) {
      throw new ApiError(403, 'OWNER_REQUIRED', 'Only an owner can grant or revoke the owner role.');
    }
    if (existing.role === Role.OWNER && input.role !== Role.OWNER) {
      await assertNotLastOwner(tx, workspace.id);
    }

    const result = await tx.workspaceUser.update({
      where: { workspaceId_userId: { userId, workspaceId: workspace.id } },
      data: { role: input.role },
      include: includeUser,
    });
    if (existing.role !== input.role) {
      await createLog(tx, workspace.id, actor.user.id, 'WorkspaceUser', userId, 'UPDATE', { userId, role: existing.role }, { userId, role: input.role });
    }
    return result;
  });

  return toWorkspaceUserDto(updated);
}

export async function deleteWorkspaceUser(workspace: Workspace, actor: MembershipActor, userId: string): Promise<{ count: number }> {
  if (userId === actor.user.id) {
    throw new ApiError(403, 'FORBIDDEN', 'You cannot remove yourself.');
  }

  await runSerializable(async (tx) => {
    const existing = await tx.workspaceUser.findUnique({
      where: { workspaceId_userId: { userId, workspaceId: workspace.id } },
    });
    if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Workspace user not found');

    if (existing.role === Role.OWNER) {
      if (!(await mayManageOwners(tx, workspace.id, actor))) {
        throw new ApiError(403, 'OWNER_REQUIRED', 'Only an owner can remove an owner.');
      }
      await assertNotLastOwner(tx, workspace.id);
    }

    await tx.workspaceUser.delete({
      where: { workspaceId_userId: { userId, workspaceId: workspace.id } },
    });
    await createLog(tx, workspace.id, actor.user.id, 'WorkspaceUser', userId, 'DELETE', { userId, role: existing.role }, null);
  });

  return { count: 1 };
}
