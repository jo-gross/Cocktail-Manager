import type { Prisma } from '@generated/prisma/client';
import prisma from '../../prisma/prisma';
import { runTx, type Tx } from '@lib/db/tx';

/**
 * Demo users are created by `/api/demo/create-workspace`: no e-mail and no
 * better-auth account. Once they have no workspace membership left they are
 * useless and are removed (sessions cascade).
 */
const ORPHAN_DEMO_USER_WHERE: Prisma.UserWhereInput = {
  email: null,
  workspaces: { none: {} },
  accounts: { none: {} },
};

async function deleteOrphanDemoUsers(tx: Tx, userIds?: string[]): Promise<number> {
  const result = await tx.user.deleteMany({
    where: { ...ORPHAN_DEMO_USER_WHERE, ...(userIds ? { id: { in: userIds } } : {}) },
  });
  return result.count;
}

async function deleteDemoWorkspaceInTx(tx: Tx, workspaceId: string): Promise<boolean> {
  const workspace = await tx.workspace.findFirst({
    where: { id: workspaceId, isDemo: true },
    select: { id: true, demoUserId: true, users: { select: { userId: true } } },
  });
  if (!workspace) return false;

  const memberIds = workspace.users.map((member) => member.userId);
  if (workspace.demoUserId) memberIds.push(workspace.demoUserId);

  // Cascades to all workspace content and memberships.
  await tx.workspace.deleteMany({ where: { id: workspace.id, isDemo: true } });
  await deleteOrphanDemoUsers(tx, memberIds);
  return true;
}

/** Deletes one demo workspace and its demo users that have no other membership (atomic). */
export async function deleteDemoWorkspace(workspaceId: string): Promise<boolean> {
  return runTx((tx) => deleteDemoWorkspaceInTx(tx, workspaceId));
}

export interface DemoCleanupResult {
  deletedWorkspaces: number;
  deletedUsers: number;
}

/**
 * Deletes expired demo workspaces (each together with its now orphaned demo users)
 * and sweeps orphaned demo users left behind by older code paths.
 * Called from `/api/demo/cleanup`; `scripts/cleanup-demo-workspaces.js` mirrors it for cron.
 */
export async function cleanupExpiredDemoWorkspaces(now = new Date()): Promise<DemoCleanupResult> {
  const expiredWorkspaces = await prisma.workspace.findMany({ where: { isDemo: true, expiresAt: { lte: now } }, select: { id: true } });

  let deletedWorkspaces = 0;
  for (const workspace of expiredWorkspaces) {
    if (await deleteDemoWorkspace(workspace.id)) deletedWorkspaces++;
  }

  const deletedUsers = await runTx((tx) => deleteOrphanDemoUsers(tx));
  console.info(`[DemoCleanup] Deleted ${deletedWorkspaces} expired demo workspace(s) and ${deletedUsers} orphaned demo user(s)`);
  return { deletedWorkspaces, deletedUsers };
}
