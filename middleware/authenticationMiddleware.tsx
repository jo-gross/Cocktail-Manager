import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../lib/prisma';
import { Role, User, Workspace } from '@prisma/client';
import { getSession } from 'next-auth/react';

export function withAuthentication(fn: (fnReq: NextApiRequest, fnRes: NextApiResponse, fnUser: User) => void) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const session = await getSession({ req });

    if (session == null) {
      return res.status(401).json({ message: 'not authenticated' });
    }

    const userResult = await prisma.user.findUnique({
      where: {
        id: session.user?.id,
      },
    });
    if (userResult == null) {
      return res.status(401).json({ message: 'user is not permitted' });
    }

    return fn(req, res, userResult);
  };
}

export function withWorkspacePermission(
  permissions: Role[],
  fn: (req: NextApiRequest, res: NextApiResponse, user: User, workspace: Workspace) => void,
) {
  return withAuthentication(async (req: NextApiRequest, res: NextApiResponse, user: User) => {
    const workspaceId = req.query.workspaceId as string | undefined;
    if (workspaceId == undefined) {
      return res.status(400).json({ message: 'workspaceId is required' });
    }

    const workspaceResult = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        users: {
          some: {
            user: user,
            role: {
              in: permissions,
            },
          },
        },
      },
    });
    if (workspaceResult == null) {
      return res.status(403).json({ message: 'not authorized' });
    }

    return fn(req, res, user, workspaceResult);
  });
}

export const withPermission = async (req: NextApiRequest, res: NextApiResponse, permissions: Role[]) => {
  try {
    const workspaceId = req.query.workspaceId as string | undefined;
    if (workspaceId == undefined) {
      return res.status(400).json({ message: 'workspaceId is required' });
    }

    const workspaceResult = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        users: {
          some: {
            user: {
              id: req.query.userId as string,
            },
            role: {
              in: permissions,
            },
          },
        },
      },
    });
    if (workspaceResult == null) {
      return res.status(403).json({ message: 'not authorized' });
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: 'not authorized' });
  }
};
