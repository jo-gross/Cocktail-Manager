/**
 * Typed client for the versioned /api/v1 surface.
 *
 * v1 responses are wrapped in a `{ data }` envelope and, on error, a
 * `{ error: { code, message, issues } }` envelope (see lib/http/responses.ts).
 * These helpers unwrap `data`, surface errors consistently, and let callers
 * type the payload with the DTO types exported from `@lib/schemas/*`
 * (pure, Prisma-free modules — safe to import types from in the browser).
 */
import { alertService } from '../alertService';
import type { PaginationMeta } from '@lib/http/responses';
import { resolveApiErrorMessage } from '@lib/i18n/apiErrors';
import { i18n } from '@lib/i18n/client';

export interface ApiV1ErrorBody {
  code: string;
  message: string;
  issues?: unknown;
}

/**
 * Reads a human-readable message from a v1 (or transitional legacy) JSON error body.
 * Prefer `error.message`; fall back to top-level `message` for older endpoints.
 */
export function getApiV1ErrorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object') {
    const record = body as { error?: { message?: unknown; code?: unknown }; message?: unknown };
    const code = typeof record.error?.code === 'string' ? record.error.code : undefined;
    if (typeof record.error?.message === 'string' && record.error.message.length > 0) {
      return resolveApiErrorMessage(code, record.error.message, fallback);
    }
    if (typeof record.message === 'string' && record.message.length > 0) {
      return resolveApiErrorMessage(code, record.message, fallback);
    }
  }
  return fallback;
}

/** Reads structured `issues` from a v1 error body, if present. */
export function getApiV1ErrorIssues<T = unknown>(body: unknown): T | undefined {
  if (body && typeof body === 'object') {
    const record = body as { error?: { issues?: T } };
    return record.error?.issues;
  }
  return undefined;
}

/** Thrown by apiV1Fetch on any non-2xx response. */
export class ApiV1RequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly issues?: unknown,
  ) {
    super(message);
    this.name = 'ApiV1RequestError';
  }
}

/** Reports an {@link ApiV1RequestError} (or generic failure) via alertService. */
export function alertApiV1Error(error: unknown, fallbackMessage: string) {
  if (error instanceof ApiV1RequestError) {
    alertService.error(resolveApiErrorMessage(error.code, error.message, fallbackMessage), error.status, error.code);
    return;
  }
  console.error(fallbackMessage, error);
  alertService.error(fallbackMessage);
}

/**
 * Fetches a v1 endpoint and returns the unwrapped `data` payload.
 * Throws {@link ApiV1RequestError} on a non-2xx response.
 */
export async function apiV1Fetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const error = (body?.error ?? {}) as Partial<ApiV1ErrorBody>;
    throw new ApiV1RequestError(response.status, error.code ?? 'ERROR', error.message ?? response.statusText, error.issues);
  }

  // Endpoints that opt out of the envelope (rare, e.g. legacy exports) return raw.
  return (body && typeof body === 'object' && 'data' in body ? body.data : body) as T;
}

/**
 * Like {@link apiV1Fetch}, but keeps pagination metadata from `{ data, pagination }`.
 */
export async function apiV1FetchPaginated<T>(path: string, init?: RequestInit): Promise<{ data: T; pagination: PaginationMeta }> {
  const response = await fetch(path, init);
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const error = (body?.error ?? {}) as Partial<ApiV1ErrorBody>;
    throw new ApiV1RequestError(response.status, error.code ?? 'ERROR', error.message ?? response.statusText, error.issues);
  }

  return {
    data: (body?.data ?? body) as T,
    pagination: (body?.pagination ?? { total: 0, page: 1, totalPages: 0, list_total: 0 }) as PaginationMeta,
  };
}

/**
 * Convenience POST/PUT/PATCH/DELETE helper with a JSON body.
 */
export function apiV1Mutate<T>(path: string, method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', body?: unknown): Promise<T> {
  return apiV1Fetch<T>(path, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

/**
 * Like {@link apiV1Fetch} but reports failures via alertService and resolves to
 * `undefined` instead of throwing — for fire-and-forget UI loads.
 */
export async function apiV1FetchSafe<T>(path: string, init?: RequestInit, errorMessage?: string): Promise<T | undefined> {
  try {
    return await apiV1Fetch<T>(path, init);
  } catch (error) {
    if (error instanceof ApiV1RequestError) {
      alertService.error(
        resolveApiErrorMessage(error.code, error.message, errorMessage ?? (i18n.t('errors:network' as never) as string)),
        error.status,
        error.code,
      );
    } else {
      console.error('apiV1FetchSafe', path, error);
      alertService.error(errorMessage ?? (i18n.t('errors:network' as never) as string));
    }
    return undefined;
  }
}

/**
 * Like {@link apiV1FetchPaginated} but reports failures via alertService.
 */
export async function apiV1FetchPaginatedSafe<T>(
  path: string,
  init?: RequestInit,
  errorMessage?: string,
): Promise<{ data: T; pagination: PaginationMeta } | undefined> {
  try {
    return await apiV1FetchPaginated<T>(path, init);
  } catch (error) {
    if (error instanceof ApiV1RequestError) {
      alertService.error(
        resolveApiErrorMessage(error.code, error.message, errorMessage ?? (i18n.t('errors:network' as never) as string)),
        error.status,
        error.code,
      );
    } else {
      console.error('apiV1FetchPaginatedSafe', path, error);
      alertService.error(errorMessage ?? (i18n.t('errors:network' as never) as string));
    }
    return undefined;
  }
}
