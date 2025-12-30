#!/usr/bin/env node

/**
 * Script to cleanup expired demo workspaces
 * This script can be called from a cron job
 * Usage: node scripts/cleanup-demo-workspaces.js
 */

// Try to load Prisma from different possible locations
let PrismaClient;
try {
  // Try standalone build location first (Docker)
  PrismaClient = require('../generated/prisma').PrismaClient;
} catch (e) {
  try {
    // Try node_modules location (local dev)
    PrismaClient = require('@prisma/client').PrismaClient;
  } catch (e2) {
    try {
      // Try relative path from node_modules
      PrismaClient = require('../node_modules/@prisma/client').PrismaClient;
    } catch (e3) {
      console.error('Could not load Prisma Client. Make sure Prisma is generated.');
      console.error('Errors:', e.message, e2.message, e3.message);
      process.exit(1);
    }
  }
}

const prisma = new PrismaClient();

async function cleanupExpiredDemoWorkspaces() {
  try {
    const now = new Date();

    // Find all expired demo workspaces
    const expiredWorkspaces = await prisma.workspace.findMany({
      where: {
        isDemo: true,
        expiresAt: {
          lte: now,
        },
      },
      include: {
        users: true,
      },
    });

    console.log(`Found ${expiredWorkspaces.length} expired demo workspace(s) to delete`);

    for (const workspace of expiredWorkspaces) {
      // Delete workspace (cascade will delete all related data)
      await prisma.workspace.delete({
        where: {
          id: workspace.id,
        },
      });

      console.log(`Deleted expired demo workspace: ${workspace.id} (${workspace.name})`);

      // Check if demo user has any other workspaces
      if (workspace.demoUserId) {
        const userWorkspaces = await prisma.workspace.findMany({
          where: {
            users: {
              some: {
                userId: workspace.demoUserId,
              },
            },
          },
        });

        // If user has no other workspaces, delete the demo user
        if (userWorkspaces.length === 0) {
          await prisma.user.delete({
            where: {
              id: workspace.demoUserId,
            },
          });

          console.log(`Deleted demo user: ${workspace.demoUserId}`);
        }
      }
    }

    console.log(`Cleanup completed. Deleted ${expiredWorkspaces.length} expired demo workspace(s)`);
    return expiredWorkspaces.length;
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
    .then((count) => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Cleanup failed:', error);
      process.exit(1);
    });
}

module.exports = { cleanupExpiredDemoWorkspaces };
