/**
 * Opaque keyset cursor of `GET /api/v1/instance/workspaces`: base64url of `{ "v": 1, "id": <last workspace id> }`.
 * Pages are ordered by workspace id, so a cursor stays valid while workspaces are created or deleted. Pure module.
 */
const CURSOR_VERSION = 1;
const MAX_ID_LENGTH = 128;

export function encodeWorkspaceCursor(lastId: string): string {
  return Buffer.from(JSON.stringify({ v: CURSOR_VERSION, id: lastId }), 'utf8').toString('base64url');
}

/** The workspace id after which the next page starts, or `null` for a malformed cursor. */
export function decodeWorkspaceCursor(cursor: string): string | null {
  if (!/^[A-Za-z0-9_-]{1,400}$/.test(cursor)) return null;
  try {
    const value: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (typeof value !== 'object' || value === null) return null;
    const { v, id } = value as { v?: unknown; id?: unknown };
    if (v !== CURSOR_VERSION || typeof id !== 'string' || id.length === 0 || id.length > MAX_ID_LENGTH) return null;
    return id;
  } catch {
    return null;
  }
}
