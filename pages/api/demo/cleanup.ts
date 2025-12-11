import { NextApiRequest, NextApiResponse } from 'next';
import HTTPMethod from 'http-method-enum';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { cleanupExpiredDemoWorkspaces } from '@lib/demo/cleanup';

/**
 * API endpoint to manually trigger cleanup of expired demo workspaces
 * Only available when DEMO_MODE is enabled
 */
export default withHttpMethods({
  [HTTPMethod.POST]: async (req: NextApiRequest, res: NextApiResponse) => {
    // Check if demo mode is enabled
    if (process.env.DEMO_MODE !== 'true') {
      return res.status(403).json({ message: 'Demo mode is not enabled' });
    }

    try {
      const deletedCount = await cleanupExpiredDemoWorkspaces();
      return res.json({
        data: {
          deletedCount,
          message: `Deleted ${deletedCount} expired demo workspace(s)`,
        },
      });
    } catch (error) {
      console.error('Error cleaning up expired demo workspaces:', error);
      return res.status(500).json({ message: 'Error cleaning up expired demo workspaces', error: String(error) });
    }
  },
});
