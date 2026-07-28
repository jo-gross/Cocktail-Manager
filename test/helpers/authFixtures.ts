import { createApiKeyJwt } from '@middleware/api/jwtApiKeyMiddleware';
import type { Permission, Role } from '@generated/prisma/client';
import type { MockRequestOptions } from './invokeHandler';

export const TEST_MASTER_API_KEY = 'ck_master_test_key_1234567890';
export const TEST_JWT_SECRET = 'test-jwt-secret-for-api-tests';

export function bearerToken(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

export function sessionCookie(token: string): Record<string, string> {
  return { cookie: `better-auth.session_token=${token}` };
}

export function asMasterKey(): Record<string, string> {
  return bearerToken(TEST_MASTER_API_KEY);
}

export function asApiKeyJwt(opts: { keyId: string; workspaceId: string; permissions: Permission[] }): Record<string, string> {
  const token = createApiKeyJwt(opts.keyId, opts.workspaceId, opts.permissions);
  return bearerToken(token);
}

export function withAuth(headers: Record<string, string>, options: MockRequestOptions = {}): MockRequestOptions {
  return { ...options, headers: { ...options.headers, ...headers } };
}

/** Returns the lowest role that satisfies the required roles list (before escalation). */
export function minimumRequiredRole(requiredRoles: Role[]): Role {
  const order: Role[] = ['USER', 'MANAGER', 'ADMIN', 'OWNER'];
  for (const role of order) {
    if (requiredRoles.includes(role)) return role;
  }
  return requiredRoles[0] ?? 'USER';
}

/** Returns a role strictly below the minimum required role, or null if USER is already minimum. */
export function roleBelowMinimum(requiredRoles: Role[]): Role | null {
  const min = minimumRequiredRole(requiredRoles);
  const order: Role[] = ['USER', 'MANAGER', 'ADMIN', 'OWNER'];
  const idx = order.indexOf(min);
  return idx > 0 ? order[idx - 1]! : null;
}

/** All roles in hierarchy order. */
export const ROLE_HIERARCHY: Role[] = ['USER', 'MANAGER', 'ADMIN', 'OWNER'];
