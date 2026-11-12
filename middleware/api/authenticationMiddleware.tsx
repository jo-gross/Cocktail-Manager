import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../prisma/prisma';
import { asWorkspace } from '../../prisma/asWorkspace';
import { Role, User, Workspace, Permission } from '@generated/prisma/client';
import { constants as HttpStatus } from 'http2';
import { auth } from '@lib/auth';
import { fail } from '@lib/http/responses';
import { authenticateApiKey, checkMasterApiKey } from './jwtApiKeyMiddleware';
import { hasPermission } from '@lib/permissions/apiKeyPermissions';
import { MASTER_API_KEY_USER_ID, setRequestApiKeyPermissions } from '@lib/http/requestAuth';

/** Value of cookie `name` from a Cookie header (values may contain `=`, e.g. signed tokens). */
function readCookie(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    const value = part.slice(separator + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return undefined;
}

/** v1 error envelope plus the historic top-level `message` for older clients. */
function authFail(res: NextApiResponse, status: number, code: string, message: string) {
  return res.status(status).json({ ...fail(code, message), message });
}

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
  const sessionToken = readCookie(req.headers.cookie, 'better-auth.session_token');
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

  return null;
}

export function withAuthentication(fn: (fnReq: NextApiRequest, fnRes: NextApiResponse, fnUser: User) => void) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const session = await getBetterAuthSession(req);

    if (session == null || !session.user?.id) {
      return authFail(res, HttpStatus.HTTP_STATUS_UNAUTHORIZED, 'UNAUTHENTICATED', 'not authenticated');
    }

    const userResult = await prisma.user.findUnique({
      where: {
        id: session.user.id,
      },
    });
    if (userResult == null) {
      return authFail(res, HttpStatus.HTTP_STATUS_UNAUTHORIZED, 'UNAUTHENTICATED', 'user is not permitted');
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
    const workspaceId = req.query.workspaceId;
    if (typeof workspaceId !== 'string' || workspaceId.length === 0) {
      return authFail(res, HttpStatus.HTTP_STATUS_BAD_REQUEST, 'VALIDATION_ERROR', 'workspaceId is required');
    }

    // Check for master API key first
    if (checkMasterApiKey(req)) {
      const workspaceResult = await prisma.workspace.findUnique({
        where: { id: workspaceId },
      });
      if (!workspaceResult) {
        return authFail(res, HttpStatus.HTTP_STATUS_NOT_FOUND, 'NOT_FOUND', 'Workspace not found');
      }
      // Master key has full access - create a dummy user for compatibility
      const dummyUser: User = {
        id: MASTER_API_KEY_USER_ID,
        name: 'Master API Key',
        email: null,
        emailVerified: false,
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setRequestApiKeyPermissions(req, 'all');
      return handler(req, res, dummyUser, asWorkspace(workspaceResult));
    }

    // Try API key authentication
    const apiKeyAuth = await authenticateApiKey(req);
    if (apiKeyAuth) {
      // Verify workspace matches
      if (apiKeyAuth.workspace.id !== workspaceId) {
        return authFail(res, HttpStatus.HTTP_STATUS_FORBIDDEN, 'FORBIDDEN', 'API key is not valid for this workspace');
      }

      // Check permissions if required
      if (apiKeyPermission) {
        const hasRequiredPermission = hasPermission(apiKeyAuth.permissions, apiKeyPermission);

        if (!hasRequiredPermission) {
          return authFail(res, HttpStatus.HTTP_STATUS_FORBIDDEN, 'FORBIDDEN', 'API key does not have required permission');
        }
      }

      // Act as the real user who created the key. Handlers use `user.id` to
      // write audit logs and to `connect` user relations (e.g. a calculation's
      // updatedByUser), which are FK-constrained to a real User row — so a
      // synthetic id would fail with P2003/P2025. authenticateApiKey only accepts
      // keys whose creator is still an ADMIN/OWNER member of the key's workspace.
      // Handlers that must not grant the creator's session role to the key check
      // getRequestApiKeyPermissions(req).
      const dummyUser: User = {
        id: apiKeyAuth.apiKey.createdByUserId,
        name: apiKeyAuth.apiKey.name,
        email: null,
        emailVerified: false,
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setRequestApiKeyPermissions(req, apiKeyAuth.permissions);
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
    const workspaceId = req.query.workspaceId;
    if (typeof workspaceId !== 'string' || workspaceId.length === 0) {
      return authFail(res, HttpStatus.HTTP_STATUS_BAD_REQUEST, 'VALIDATION_ERROR', 'workspaceId is required');
    }

    return withAuthentication(async (sessionReq: NextApiRequest, sessionRes: NextApiResponse, user: User) => {
      const workspaceResult = await prisma.workspace.findFirst({
        where: {
          id: workspaceId,
          users: { some: { userId: user.id, role: { in: allowedRoles } } },
        },
      });
      if (workspaceResult == null) {
        return authFail(sessionRes, HttpStatus.HTTP_STATUS_FORBIDDEN, 'FORBIDDEN', 'User is not permitted');
      }

      return fn(sessionReq, sessionRes, user, asWorkspace(workspaceResult));
    })(req, res);
  };
}
