import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../lib/prisma';
import { Role, User, Workspace, WorkspaceUser } from '@prisma/client';
import { constants as HttpStatus } from 'http2';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../pages/api/auth/[...nextauth]';

export function withAuthentication(fn: (fnReq: NextApiRequest, fnRes: NextApiResponse, fnUser: User) => void) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
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

export function withWorkspacePermission(
  permissions: Role[],
  fn: (req: NextApiRequest, res: NextApiResponse, user: User, workspace: Workspace) => void,
) {
  return withAuthentication(async (req: NextApiRequest, res: NextApiResponse, user: User) => {
    const workspaceId = req.query.workspaceId as string | undefined;
    if (workspaceId == undefined) {
      return res.status(HttpStatus.HTTP_STATUS_BAD_REQUEST).json({ message: 'workspaceId is required' });
    }

    if (permissions.includes(Role.USER)) {
      if (!permissions.includes(Role.MANAGER)) {
        permissions.push(Role.MANAGER);
      }
      if (!permissions.includes(Role.ADMIN)) {
        permissions.push(Role.ADMIN);
      }
      if (!permissions.includes(Role.OWNER)) {
        permissions.push(Role.OWNER);
      }
    }

    if (permissions.includes(Role.MANAGER)) {
      if (!permissions.includes(Role.ADMIN)) {
        permissions.push(Role.ADMIN);
      }
      if (!permissions.includes(Role.OWNER)) {
        permissions.push(Role.OWNER);
      }
    }

    if (permissions.includes(Role.ADMIN)) {
      if (!permissions.includes(Role.OWNER)) {
        permissions.push(Role.OWNER);
      }
    }

    const workspaceResult: (Workspace & { users: WorkspaceUser[] }) | null = await prisma.workspace.findFirst({
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
      include: {
        users: true,
      },
    });
    if (workspaceResult == null) {
      return res.status(HttpStatus.HTTP_STATUS_FORBIDDEN).json({ message: 'User is not permitted' });
    }

    return fn(req, res, user, workspaceResult);
  });
}
