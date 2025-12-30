import prisma from '../../prisma/prisma';

/**
 * Cleanup function to delete expired demo workspaces
 * This function can be called from a cron job or API endpoint
 */
export async function cleanupExpiredDemoWorkspaces() {
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

    return expiredWorkspaces.length;
  } catch (error) {
    console.error('Error cleaning up expired demo workspaces:', error);
    throw error;
  }
}
