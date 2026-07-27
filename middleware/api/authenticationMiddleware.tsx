import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../prisma/prisma';
import { Role, User, Workspace, WorkspaceUser, Permission } from '@generated/prisma/client';
import { constants as HttpStatus } from 'http2';
import { auth } from '@lib/auth';
import { authenticateApiKey, checkMasterApiKey } from './jwtApiKeyMiddleware';
import { hasPermission } from '@lib/permissions/apiKeyPermissions';

/**
 * Helper function to get session from BetterAuth
 * Converts NextApiRequest headers to Web Headers format
 */
async function getBetterAuthSession(req: NextApiRequest) {
  // Convert Node.js headers to Web Headers
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) {
      headers.set(key, Array.isArray(value) ? value.join(', ') : value);
    }
  }

  // Try BetterAuth first
  try {
    const session = await auth.api.getSession({ headers });
    if (session) {
      return session;
    }
  } catch (error) {
    console.error('BetterAuth getSession error:', error);
  }

  // Fallback: Check for demo session directly via cookie
  // This is needed because demo sessions are created manually, not through BetterAuth
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').reduce(
      (acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      },
      {} as Record<string, string>,
    );

    const sessionToken = cookies['better-auth.session_token'];
    if (sessionToken) {
      // Look up session directly in database
      const dbSession = await prisma.session.findFirst({
        where: {
          token: sessionToken,
          expiresAt: { gt: new Date() },
        },
        include: { user: true },
      });

      if (dbSession) {
        return {
          session: {
            id: dbSession.id,
            token: dbSession.token,
            userId: dbSession.userId,
            expiresAt: dbSession.expiresAt,
          },
          user: {
            id: dbSession.user.id,
            name: dbSession.user.name,
            email: dbSession.user.email,
            image: dbSession.user.image,
            emailVerified: dbSession.user.emailVerified,
          },
        };
      }
    }
  }

  return null;
}

export function withAuthentication(fn: (fnReq: NextApiRequest, fnRes: NextApiResponse, fnUser: User) => void) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const session = await getBetterAuthSession(req);

    if (session == null) {
      // Debug: Log cookies for troubleshooting
      console.log('Auth failed - no session. Cookies:', req.headers.cookie);
      return res.status(HttpStatus.HTTP_STATUS_UNAUTHORIZED).json({ message: 'not authenticated' });
    }

    const userResult = await prisma.user.findUnique({
      where: {
        id: session.user?.id,
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
        emailVerified: false,
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
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
        const hasRequiredPermission = hasPermission(apiKeyAuth.permissions, apiKeyPermission);

        if (!hasRequiredPermission) {
          return res.status(HttpStatus.HTTP_STATUS_FORBIDDEN).json({ message: 'API key does not have required permission' });
        }
      }

      // Act as the real user who created the key. Handlers use `user.id` to
      // write audit logs and to `connect` user relations (e.g. a calculation's
      // updatedByUser), which are FK-constrained to a real User row — so a
      // synthetic id would fail with P2003/P2025. createdByUserId is a required
      // FK with onDelete: Cascade, so it always references an existing user for
      // any key that still authenticates.
      const dummyUser: User = {
        id: apiKeyAuth.apiKey.createdByUserId,
        name: apiKeyAuth.apiKey.name,
        email: null,
        emailVerified: false,
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      return handler(req, res, dummyUser, apiKeyAuth.workspace);
    }

    // Fall back to a logged-in workspace-member session.
    return withWorkspaceSession(permissions, handler)(req, res);
  };
}

/** Expand a role list down the hierarchy (USER ⊂ MANAGER ⊂ ADMIN ⊂ OWNER) without mutating the input. */
function escalateRoles(roles: Role[]): Role[] {
  const set = new Set(roles);
  if (set.has(Role.USER)) {
    set.add(Role.MANAGER);
    set.add(Role.ADMIN);
    set.add(Role.OWNER);
  }
  if (set.has(Role.MANAGER)) {
    set.add(Role.ADMIN);
    set.add(Role.OWNER);
  }
  if (set.has(Role.ADMIN)) {
    set.add(Role.OWNER);
  }
  return Array.from(set);
}

/**
 * Session-only workspace auth: authenticates the caller by a logged-in workspace-member SESSION
 * (role-hierarchy escalation + membership check). Unlike `withWorkspacePermission`, it does NOT accept
 * API keys or the instance master key — use it for operations that act on the caller's own identity or
 * write a real-user FK (leave, api-key create/delete, join-request self-cancel).
 */
export function withWorkspaceSession(
  permissions: Role[],
  fn: (req: NextApiRequest, res: NextApiResponse, user: User, workspace: Workspace) => void,
): (req: NextApiRequest, res: NextApiResponse) => Promise<void> {
  const allowedRoles = escalateRoles(permissions);
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const workspaceId = req.query.workspaceId as string | undefined;
    if (workspaceId == undefined) {
      return res.status(HttpStatus.HTTP_STATUS_BAD_REQUEST).json({ message: 'workspaceId is required' });
    }

    return withAuthentication(async (sessionReq: NextApiRequest, sessionRes: NextApiResponse, user: User) => {
      const workspaceResult: (Workspace & { users: WorkspaceUser[] }) | null = await prisma.workspace.findFirst({
        where: {
          id: workspaceId,
          users: { some: { user: user, role: { in: allowedRoles } } },
        },
        include: { users: true },
      });
      if (workspaceResult == null) {
        return sessionRes.status(HttpStatus.HTTP_STATUS_FORBIDDEN).json({ message: 'User is not permitted' });
      }

      return fn(sessionReq, sessionRes, user, workspaceResult);
    })(req, res);
  };
}
