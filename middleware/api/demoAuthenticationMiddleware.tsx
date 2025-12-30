import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../prisma/prisma';
import { User, Workspace } from '@generated/prisma/client';
import { constants as HttpStatus } from 'http2';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../pages/api/auth/[...nextauth]';

/**
 * Middleware for demo mode authentication
 * Allows access to demo workspaces without normal authentication
 */
export function withDemoAuthentication(fn: (fnReq: NextApiRequest, fnRes: NextApiResponse, fnUser: User) => void) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    // Check if demo mode is enabled
    if (process.env.DEMO_MODE !== 'true') {
      return res.status(HttpStatus.HTTP_STATUS_FORBIDDEN).json({ message: 'Demo mode is not enabled' });
    }

    // Try to get session (could be demo session or normal session)
    const serverSession = await getServerSession(req, res, authOptions);

    if (serverSession == null) {
      return res.status(HttpStatus.HTTP_STATUS_UNAUTHORIZED).json({ message: 'not authenticated' });
    }

    const userResult = await prisma.user.findUnique({
      where: {
        id: serverSession.user?.id,
      },
    });

    if (userResult == null) {
      return res.status(HttpStatus.HTTP_STATUS_UNAUTHORIZED).json({ message: 'user is not permitted' });
    }

    return fn(req, res, userResult);
  };
}

/**
 * Middleware for demo workspace access
 * Checks if workspace is a demo workspace and if it's still valid (not expired)
 */
export function withDemoWorkspacePermission(fn: (req: NextApiRequest, res: NextApiResponse, user: User, workspace: Workspace) => void) {
  return withDemoAuthentication(async (req: NextApiRequest, res: NextApiResponse, user: User) => {
    const workspaceId = req.query.workspaceId as string | undefined;
    if (workspaceId == undefined) {
      return res.status(HttpStatus.HTTP_STATUS_BAD_REQUEST).json({ message: 'workspaceId is required' });
    }

    const workspaceResult = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        isDemo: true,
        users: {
          some: {
            userId: user.id,
          },
        },
      },
    });

    if (workspaceResult == null) {
      return res.status(HttpStatus.HTTP_STATUS_FORBIDDEN).json({ message: 'Workspace not found or not a demo workspace' });
    }

    // Check if workspace has expired
    if (workspaceResult.expiresAt && workspaceResult.expiresAt < new Date()) {
      // Workspace has expired, delete it
      await prisma.workspace.delete({
        where: {
          id: workspaceId,
        },
      });

      return res.status(HttpStatus.HTTP_STATUS_GONE).json({ message: 'Demo workspace has expired and has been deleted' });
    }

    return fn(req, res, user, workspaceResult);
  });
}
