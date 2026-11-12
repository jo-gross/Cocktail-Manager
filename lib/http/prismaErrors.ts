/**
 * Maps known Prisma request errors to ApiErrors so handlers answer 404/409
 * instead of a generic 500. Duck-typed on `code` because the generated client
 * can be loaded more than once (tests, Next bundles), which breaks instanceof.
 */
import { ApiError } from './ApiError';

interface PrismaKnownError {
  code: string;
  meta?: Record<string, unknown>;
}

function isPrismaKnownError(error: unknown): error is PrismaKnownError {
  if (typeof error !== 'object' || error === null) return false;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && /^P\d{4}$/.test(code);
}

/** Postgres serialization failure / deadlock surfaced through the driver adapter. */
export function isRetryableTransactionError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const code = (error as { code?: unknown }).code;
  if (code === 'P2034') return true;
  const message = error instanceof Error ? error.message : '';
  return /could not serialize access|deadlock detected|40001|40P01/.test(message);
}

export function prismaErrorToApiError(error: unknown): ApiError | null {
  if (error instanceof ApiError) return error;
  if (!isPrismaKnownError(error)) return null;

  switch (error.code) {
    case 'P2025':
    case 'P2015':
    case 'P2018':
      return new ApiError(404, 'NOT_FOUND', 'The requested record was not found');
    case 'P2002':
      return new ApiError(409, 'CONFLICT', 'A record with these values already exists');
    case 'P2003':
    case 'P2014':
      return new ApiError(409, 'REFERENCE_CONFLICT', 'The record is still referenced or references a missing record');
    case 'P2034':
      return new ApiError(409, 'TRANSACTION_CONFLICT', 'The request conflicted with a concurrent change, please retry');
    case 'P2000':
      return new ApiError(400, 'VALUE_TOO_LONG', 'A provided value is too long');
    default:
      return null;
  }
}
