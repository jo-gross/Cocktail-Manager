/**
 * Transaction helpers. See docs/BACKEND-CONVENTIONS.md for when to use which.
 *
 * - `runTx`: interactive transaction with sane default timeouts and optional
 *   isolation level; retries serialization failures / deadlocks.
 * - `lockWorkspaceScope`: transaction-scoped advisory lock that serializes
 *   read-then-write sequences (e.g. `max(order) + 1`) per workspace and scope.
 */
import type { Prisma } from '@generated/prisma/client';
import prisma, { type AppPrismaClient } from '../../prisma/prisma';
import { isRetryableTransactionError } from '@lib/http/prismaErrors';

/** Either the root client or an interactive transaction client. */
export type Db = Prisma.TransactionClient | AppPrismaClient;
export type Tx = Prisma.TransactionClient;

export interface RunTxOptions {
  /** Max time to wait for a connection from the pool (ms). */
  maxWait?: number;
  /** Max time the transaction callback may run (ms). */
  timeout?: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
  /** Retries for serialization failures / deadlocks (default 2 with Serializable, else 0). */
  retries?: number;
}

export const DEFAULT_TX_TIMEOUT_MS = 15_000;
export const DEFAULT_TX_MAX_WAIT_MS = 5_000;
/** For imports and other bulk writes. Parse and validate before opening the transaction. */
export const BULK_TX_TIMEOUT_MS = 120_000;

export async function runTx<T>(fn: (tx: Tx) => Promise<T>, options: RunTxOptions = {}): Promise<T> {
  const { retries = options.isolationLevel === 'Serializable' ? 2 : 0, ...txOptions } = options;
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction((tx) => fn(tx), {
        maxWait: txOptions.maxWait ?? DEFAULT_TX_MAX_WAIT_MS,
        timeout: txOptions.timeout ?? DEFAULT_TX_TIMEOUT_MS,
        isolationLevel: txOptions.isolationLevel,
      });
    } catch (error) {
      if (attempt < retries && isRetryableTransactionError(error)) continue;
      throw error;
    }
  }
}

/**
 * Serializes concurrent transactions that touch the same `scope` of a workspace
 * (released automatically on commit/rollback). Use it before reading values a
 * write depends on, e.g. the next `order`, a default flag or generated rows.
 */
export async function lockWorkspaceScope(tx: Tx, workspaceId: string, scope: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${scope}), hashtext(${workspaceId}))`;
}
