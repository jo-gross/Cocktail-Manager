#!/usr/bin/env node

/**
 * Script to cleanup expired demo workspaces (mirror of lib/demo/cleanup.ts for cron jobs)
 * Usage: node scripts/cleanup-demo-workspaces.js
 *
 * Each expired demo workspace is deleted together with its demo users that have no
 * other membership in one transaction; afterwards orphaned demo users (no e-mail,
 * no membership, no login account) are removed.
 */

let PrismaClient;
let PrismaPg;
try {
  // Generated client (standalone build and local dev)
  PrismaClient = require('../generated/prisma').PrismaClient;
  PrismaPg = require('@prisma/adapter-pg').PrismaPg;
} catch (e) {
  console.error('Could not load Prisma Client. Make sure Prisma is generated.');
  console.error('Error:', e.message);
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const ORPHAN_DEMO_USER_WHERE = { email: null, workspaces: { none: {} }, accounts: { none: {} } };

async function deleteDemoWorkspace(workspaceId) {
  return prisma.$transaction(async (tx) => {
    const workspace = await tx.workspace.findFirst({
      where: { id: workspaceId, isDemo: true },
      select: { id: true, demoUserId: true, users: { select: { userId: true } } },
    });
    if (!workspace) return false;
    const memberIds = workspace.users.map((member) => member.userId);
    if (workspace.demoUserId) memberIds.push(workspace.demoUserId);

    // Cascades to all workspace content and memberships.
    await tx.workspace.deleteMany({ where: { id: workspace.id, isDemo: true } });
    await tx.user.deleteMany({ where: { ...ORPHAN_DEMO_USER_WHERE, id: { in: memberIds } } });
    return true;
  });
}

async function cleanupExpiredDemoWorkspaces() {
  try {
    const expiredWorkspaces = await prisma.workspace.findMany({
      where: { isDemo: true, expiresAt: { lte: new Date() } },
      select: { id: true },
    });
    console.log(`Found ${expiredWorkspaces.length} expired demo workspace(s) to delete`);

    let deletedWorkspaces = 0;
    for (const workspace of expiredWorkspaces) {
      if (await deleteDemoWorkspace(workspace.id)) {
        deletedWorkspaces++;
        console.log(`Deleted expired demo workspace: ${workspace.id}`);
      }
    }

    const { count: deletedUsers } = await prisma.user.deleteMany({ where: ORPHAN_DEMO_USER_WHERE });
    console.log(`Cleanup completed. Deleted ${deletedWorkspaces} expired demo workspace(s) and ${deletedUsers} orphaned demo user(s)`);
    return deletedWorkspaces;
  } catch (error) {
    console.error('Error cleaning up expired demo workspaces:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run cleanup if script is executed directly
if (require.main === module) {
  cleanupExpiredDemoWorkspaces()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Cleanup failed:', error);
      process.exit(1);
    });
}

module.exports = { cleanupExpiredDemoWorkspaces };
