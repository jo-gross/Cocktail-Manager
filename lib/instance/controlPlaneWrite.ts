/**
 * Runs a write of the control plane (instance API): the change, its `InstanceAuditLog` entry with `X-CM-Actor` and
 * `X-CM-Reason`, and the answer stored per `Idempotency-Key` commit in one transaction.
 *
 * Idempotency: a retry with the same key and the same request gets the stored answer and changes nothing. The same
 * key with another request is refused (409 `IDEMPOTENCY_KEY_REUSED`). Failed writes store nothing, so a retry runs
 * again. Without a key every call is applied. See docs/INSTANCE-API.md.
 */
import type { IncomingHttpHeaders } from 'node:http';
import type { Prisma } from '@generated/prisma/client';
import prisma from '../../prisma/prisma';
import { ApiError } from '@lib/http/ApiError';
import { runTx, type RunTxOptions, type Tx } from '@lib/db/tx';
import { parseControlPlaneHeaders, type ControlPlaneHeaders } from '@lib/instance/controlPlaneHeaders';
import { requestFingerprint } from '@lib/instance/fingerprint';

export type ControlPlaneTargetType = 'instance' | 'workspace' | 'user';

export interface ControlPlaneWrite<T> {
  headers: IncomingHttpHeaders;
  /** e.g. `announcements.replace`. */
  action: string;
  target: { type: ControlPlaneTargetType; id: string | null };
  /** Request body; part of the fingerprint a reused key is checked against. */
  payload?: unknown;
  isolationLevel?: RunTxOptions['isolationLevel'];
  /** The change. `response` is answered and stored; `details` only go to the audit entry. Never put secrets in either. */
  apply: (tx: Tx, headers: ControlPlaneHeaders) => Promise<{ response: T; details?: Prisma.InputJsonValue }>;
}

/** The stored answer of `key`, `undefined` if the key is unknown. Throws when the key belongs to another request. */
async function storedAnswer<T>(key: string, requestHash: string): Promise<{ response: T } | undefined> {
  const entry = await prisma.instanceAuditLog.findUnique({ where: { idempotencyKey: key }, select: { requestHash: true, response: true } });
  if (!entry) return undefined;
  if (entry.requestHash !== requestHash) {
    throw new ApiError(409, 'IDEMPOTENCY_KEY_REUSED', 'This Idempotency-Key was already used for another request');
  }
  return { response: entry.response as T };
}

export async function runControlPlaneWrite<T>(write: ControlPlaneWrite<T>): Promise<T> {
  const parsed = parseControlPlaneHeaders(write.headers);
  if (!parsed.ok) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid request headers', parsed.issues);
  const headers = parsed.value;
  const requestHash = requestFingerprint(write.action, write.target, write.payload);
  const key = headers.idempotencyKey;

  if (key) {
    const stored = await storedAnswer<T>(key, requestHash);
    if (stored) return stored.response;
  }

  try {
    return await runTx(
      async (tx) => {
        const { response, details } = await write.apply(tx, headers);
        await tx.instanceAuditLog.create({
          data: {
            action: write.action,
            targetType: write.target.type,
            targetId: write.target.id,
            actor: headers.actor,
            reason: headers.reason,
            idempotencyKey: key,
            requestHash,
            response: response as Prisma.InputJsonValue,
            details,
          },
        });
        return response;
      },
      { isolationLevel: write.isolationLevel },
    );
  } catch (error) {
    // A concurrent request with the same key committed first (unique key, or its change made this one fail): answer
    // like a retry.
    if (key) {
      const stored = await storedAnswer<T>(key, requestHash);
      if (stored) return stored.response;
    }
    throw error;
  }
}
