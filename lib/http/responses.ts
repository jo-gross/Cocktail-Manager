/**
 * Standardized v1 response envelopes. Legacy (unversioned) endpoints keep their
 * historic shapes untouched — these helpers are for the /api/v1 surface only.
 */
import type { NextApiResponse } from 'next';

export interface PaginationMeta {
  total: number;
  page: number;
  totalPages: number;
  list_total: number;
}

export type ApiOk<T> = { data: T };
export type ApiPaginated<T> = { data: T; pagination: PaginationMeta };
export type ApiError = { error: { code: string; message: string; issues?: unknown } };

export function ok<T>(data: T): ApiOk<T> {
  return { data };
}

export function paginated<T>(data: T, pagination: PaginationMeta): ApiPaginated<T> {
  return { data, pagination };
}

export function fail(code: string, message: string, issues?: unknown): ApiError {
  return { error: { code, message, ...(issues !== undefined ? { issues } : {}) } };
}

export function sendOk<T>(res: NextApiResponse, data: T, status = 200) {
  return res.status(status).json(ok(data));
}

export function sendFail(res: NextApiResponse, status: number, code: string, message: string, issues?: unknown) {
  return res.status(status).json(fail(code, message, issues));
}
