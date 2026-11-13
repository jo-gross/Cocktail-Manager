/**
 * Helpers for integration scenarios: two isolated workspaces (tenant A and B)
 * with one user per role, and a compact way to call a handler as a user.
 */
import type { Role } from '@generated/prisma/client';
import { invokeHandler, type ApiHandler, type HandlerResult } from './invokeHandler';
import { asMasterKey, bearerToken, sessionCookie } from './authFixtures';
import { findUserByRole, seedWorkspace, type SeededUser, type SeededWorkspace } from './dbFixtures';

export const ALL_ROLES: Role[] = ['USER', 'MANAGER', 'ADMIN', 'OWNER'];

export interface TenantPair {
  a: SeededWorkspace;
  b: SeededWorkspace;
}

export async function seedTenantPair(): Promise<TenantPair> {
  const users = ALL_ROLES.map((role) => ({ role }));
  const a = await seedWorkspace({ name: 'Tenant A', users });
  const b = await seedWorkspace({ name: 'Tenant B', users });
  return { a, b };
}

export type Caller = SeededUser | { apiKeyJwt: string } | 'master' | 'anonymous';

function authHeaders(caller: Caller): Record<string, string> {
  if (caller === 'anonymous') return {};
  if (caller === 'master') return asMasterKey();
  if ('apiKeyJwt' in caller) return bearerToken(caller.apiKeyJwt);
  return sessionCookie(caller.sessionToken);
}

export interface CallOptions {
  method: string;
  query?: Record<string, string | string[] | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
}

/** Invokes `handler` as `caller` (session user, API key, master key or anonymous). */
export function callAs(caller: Caller, handler: ApiHandler, options: CallOptions): Promise<HandlerResult> {
  return invokeHandler(handler, {
    method: options.method,
    query: options.query,
    body: options.body,
    headers: { ...options.headers, ...authHeaders(caller) },
  });
}

export function roleUser(workspace: SeededWorkspace, role: Role): SeededUser {
  return findUserByRole(workspace, role);
}

/** `data` of a v1 `{ data }` envelope. */
export function dataOf<T = unknown>(result: HandlerResult): T {
  return (result.json as { data: T }).data;
}

/** `error.code` of a v1 `{ error }` envelope. */
export function errorCodeOf(result: HandlerResult): string | undefined {
  return (result.json as { error?: { code?: string } } | undefined)?.error?.code;
}
