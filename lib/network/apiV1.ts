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

export interface ApiV1ErrorBody {
  code: string;
  message: string;
  issues?: unknown;
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
      alertService.error(errorMessage ?? error.message, error.status, error.code);
    } else {
      console.error('apiV1FetchSafe', path, error);
      alertService.error(errorMessage ?? 'Netzwerkfehler');
    }
    return undefined;
  }
}
