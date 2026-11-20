/**
 * Fingerprint of a control plane write, to tell a retry (same `Idempotency-Key`, same request) from a key reused for
 * another request. Pure module.
 */
import { createHash } from 'node:crypto';

/** JSON with sorted object keys, so equal requests get equal fingerprints. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((entry) => canonicalJson(entry)).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

export function requestFingerprint(action: string, target: { type: string; id: string | null }, payload: unknown): string {
  return createHash('sha256')
    .update(canonicalJson({ action, target: { type: target.type, id: target.id }, payload: payload ?? null }))
    .digest('hex');
}
