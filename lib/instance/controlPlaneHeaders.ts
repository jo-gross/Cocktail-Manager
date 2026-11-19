/**
 * Headers the control plane sends with instance API calls (contract `components.parameters`):
 * `X-CM-Actor` (email of the acting administrator), `X-CM-Reason` (reason of a write) and `Idempotency-Key`
 * (UUID of a write). Reads only carry the actor; writes put actor and reason into the app audit log.
 */
import type { IncomingHttpHeaders } from 'node:http';

export const MAX_ACTOR_LENGTH = 254;
export const MAX_REASON_LENGTH = 500;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/g;

export interface ControlPlaneHeaders {
  actor: string | null;
  reason: string | null;
  idempotencyKey: string | null;
}

export type ControlPlaneHeadersResult = { ok: true; value: ControlPlaneHeaders } | { ok: false; issues: Array<{ header: string; message: string }> };

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Trimmed text without control characters, `null` when empty, `undefined` when longer than `max`. */
function cleanText(value: string | undefined, max: number): string | null | undefined {
  if (value === undefined) return null;
  const cleaned = value.replace(CONTROL_CHARACTERS, ' ').trim();
  if (cleaned === '') return null;
  return cleaned.length > max ? undefined : cleaned;
}

/** Parses and bounds the control plane headers. Invalid values are reported, never silently cut. */
export function parseControlPlaneHeaders(headers: IncomingHttpHeaders): ControlPlaneHeadersResult {
  const issues: Array<{ header: string; message: string }> = [];

  const actor = cleanText(single(headers['x-cm-actor']), MAX_ACTOR_LENGTH);
  if (actor === undefined) issues.push({ header: 'X-CM-Actor', message: `At most ${MAX_ACTOR_LENGTH} characters` });

  const reason = cleanText(single(headers['x-cm-reason']), MAX_REASON_LENGTH);
  if (reason === undefined) issues.push({ header: 'X-CM-Reason', message: `At most ${MAX_REASON_LENGTH} characters` });

  const rawKey = single(headers['idempotency-key'])?.trim();
  const idempotencyKey = rawKey ? rawKey.toLowerCase() : null;
  if (idempotencyKey !== null && !UUID.test(idempotencyKey)) issues.push({ header: 'Idempotency-Key', message: 'Must be a UUID' });

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: { actor: actor ?? null, reason: reason ?? null, idempotencyKey } };
}
