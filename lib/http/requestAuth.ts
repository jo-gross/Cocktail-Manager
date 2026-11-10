/**
 * Request-scoped info about how a request was authenticated (set by
 * `withWorkspacePermission`). API-key requests act as the key's creator
 * (`user`), so handlers that must not grant the creator's role to the key
 * check the key's own permissions here.
 */
import type { IncomingMessage } from 'http';
import type { Permission } from '@generated/prisma/client';

/** `all` = instance master key. */
export type RequestApiKeyPermissions = readonly Permission[] | 'all';

const apiKeyAuth = new WeakMap<IncomingMessage, RequestApiKeyPermissions>();

export function setRequestApiKeyPermissions(req: IncomingMessage, permissions: RequestApiKeyPermissions): void {
  apiKeyAuth.set(req, permissions);
}

/** Permissions of the API key that authenticated `req`, or `null` for session requests. */
export function getRequestApiKeyPermissions(req: IncomingMessage): RequestApiKeyPermissions | null {
  return apiKeyAuth.get(req) ?? null;
}
