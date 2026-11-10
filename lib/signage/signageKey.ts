/**
 * Monitor key (`Workspace.signageKey`, server only): bearer secret of the
 * monitor link `/signage?id={workspaceId}&key={key}`.
 *
 * `/api/signage/{id}` is public; signage access tokens for PIN-protected guest
 * menus are only issued when the request carries the workspace's current key.
 * Everything else (image slides, unprotected menus) works without it.
 *
 * - 32 random bytes, base64url (43 chars). Stored in plain text because the
 *   admin page shows/copies it (it grants read access to protected menus only).
 * - Regenerating replaces the key → old monitor links lose access to protected
 *   menus (tokens they already hold expire after ≤ 24 h or on a code change).
 * - Not part of backups (the workspace row is not exported): after an import
 *   into another workspace a new key has to be generated.
 */
import { createHash, randomBytes, timingSafeEqual } from 'crypto';

export const SIGNAGE_KEY_BYTES = 32;
const MAX_KEY_LENGTH = 128;

export function generateSignageKey(): string {
  return randomBytes(SIGNAGE_KEY_BYTES).toString('base64url');
}

/** Constant-time comparison (hashes first, so length differences do not leak either). */
export function isValidSignageKey(provided: unknown, stored: string | null | undefined): boolean {
  if (!stored || typeof provided !== 'string' || provided.length === 0 || provided.length > MAX_KEY_LENGTH) return false;
  const expected = createHash('sha256').update(stored).digest();
  const actual = createHash('sha256').update(provided).digest();
  return timingSafeEqual(expected, actual);
}

/** Relative monitor URL (`key` omitted when the workspace has none). */
export function buildSignagePath(workspaceId: string, key: string | null | undefined): string {
  const query = new URLSearchParams({ id: workspaceId });
  if (key) query.set('key', key);
  return `/signage?${query.toString()}`;
}
