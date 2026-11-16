import { createHash, timingSafeEqual } from 'crypto';
import { NextApiRequest, NextApiResponse } from 'next';
import HTTPMethod from 'http-method-enum';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { checkMasterApiKey } from '@middleware/api/jwtApiKeyMiddleware';
import { sendFail } from '@lib/http/responses';
import { cleanupExpiredDemoWorkspaces } from '@lib/demo/cleanup';
import { isDemoMode } from '@lib/demo/config';

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

/** `Authorization: Bearer <DEMO_CLEANUP_SECRET>` (constant-time) or the instance master key. */
function isAuthorized(req: NextApiRequest): boolean {
  const secret = process.env.DEMO_CLEANUP_SECRET;
  const header = req.headers.authorization;
  if (secret && header?.startsWith('Bearer ')) {
    // Compare fixed-length digests so neither content nor length leaks.
    if (timingSafeEqual(digest(header.slice('Bearer '.length).trim()), digest(secret))) return true;
  }
  return checkMasterApiKey(req);
}

/**
 * Deletes expired demo workspaces and orphaned demo users. Only available when
 * DEMO_MODE is enabled; requires DEMO_CLEANUP_SECRET or the master key.
 */
export default withHttpMethods({
  [HTTPMethod.POST]: async (req: NextApiRequest, res: NextApiResponse) => {
    if (!isDemoMode()) {
      return sendFail(res, 403, 'DEMO_DISABLED', 'Demo mode is not enabled');
    }
    if (!isAuthorized(req)) {
      return sendFail(res, 401, 'UNAUTHORIZED', 'Cleanup secret or master API key required');
    }

    const { deletedWorkspaces, deletedUsers } = await cleanupExpiredDemoWorkspaces();
    return res.json({
      data: {
        deletedCount: deletedWorkspaces,
        deletedUsers,
        message: `Deleted ${deletedWorkspaces} expired demo workspace(s)`,
      },
    });
  },
});
