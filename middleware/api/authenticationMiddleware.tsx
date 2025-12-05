import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../prisma/prisma';
import { Role, User, Workspace, WorkspaceUser, Permission } from '@generated/prisma/client';
import { constants as HttpStatus } from 'http2';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../pages/api/auth/[...nextauth]';
import { authenticateApiKey, checkMasterApiKey, ApiKeyAuthResult } from './apiKeyMiddleware';
import { hasPermission } from '@lib/permissions/apiKeyPermissions';

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

// Overload for with API key permission
export function withWorkspacePermission(
  permissions: Role[],
  apiKeyPermission: Permission | null,
  fn: (req: NextApiRequest, res: NextApiResponse, user: User, workspace: Workspace) => void,
): (req: NextApiRequest, res: NextApiResponse) => Promise<void>;
// Overload for without API key permission (backward compatibility)
export function withWorkspacePermission(
  permissions: Role[],
  fn: (req: NextApiRequest, res: NextApiResponse, user: User, workspace: Workspace) => void,
): (req: NextApiRequest, res: NextApiResponse) => Promise<void>;
// Implementation
export function withWorkspacePermission(
  permissions: Role[],
  apiKeyPermissionOrFn: Permission | null | ((req: NextApiRequest, res: NextApiResponse, user: User, workspace: Workspace) => void),
  fn?: (req: NextApiRequest, res: NextApiResponse, user: User, workspace: Workspace) => void,
) {
  // Determine if apiKeyPermissionOrFn is actually the function (backward compatibility)
  const apiKeyPermission = typeof apiKeyPermissionOrFn === 'function' ? null : (apiKeyPermissionOrFn as Permission | null);
  const handler = typeof apiKeyPermissionOrFn === 'function' ? apiKeyPermissionOrFn : fn!;

  return async (req: NextApiRequest, res: NextApiResponse) => {
    const workspaceId = req.query.workspaceId as string | undefined;
    if (workspaceId == undefined) {
      return res.status(HttpStatus.HTTP_STATUS_BAD_REQUEST).json({ message: 'workspaceId is required' });
    }

    // Check for master API key first
    if (checkMasterApiKey(req)) {
      const workspaceResult = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        include: { users: true },
      });
      if (!workspaceResult) {
        return res.status(HttpStatus.HTTP_STATUS_NOT_FOUND).json({ message: 'Workspace not found' });
      }
      // Master key has full access - create a dummy user for compatibility
      const dummyUser: User = {
        id: 'master-api-key',
        name: 'Master API Key',
        email: null,
        emailVerified: null,
        image: null,
      };
      return handler(req, res, dummyUser, workspaceResult);
    }

    // Try API key authentication
    const apiKeyAuth = await authenticateApiKey(req);
    if (apiKeyAuth) {
      // Verify workspace matches
      if (apiKeyAuth.workspace.id !== workspaceId) {
        return res.status(HttpStatus.HTTP_STATUS_FORBIDDEN).json({ message: 'API key is not valid for this workspace' });
      }

      // Check permissions if required
      if (apiKeyPermission) {
        const path = req.url?.split('?')[0] || '';
        const hasRequiredPermission = hasPermission(apiKeyAuth.permissions, apiKeyPermission, path);

        if (!hasRequiredPermission) {
          return res.status(HttpStatus.HTTP_STATUS_FORBIDDEN).json({ message: 'API key does not have required permission' });
        }
      }

      // Create a dummy user for compatibility
      const dummyUser: User = {
        id: apiKeyAuth.apiKey.id,
        name: apiKeyAuth.apiKey.name,
        email: null,
        emailVerified: null,
        image: null,
      };
      return handler(req, res, dummyUser, apiKeyAuth.workspace);
    }

    // Fall back to session-based authentication
    return withAuthentication(async (req: NextApiRequest, res: NextApiResponse, user: User) => {
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

      return handler(req, res, user, workspaceResult);
    })(req, res);
  };
}
