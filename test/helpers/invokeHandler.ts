import type { NextApiRequest, NextApiResponse } from 'next';
import { vi } from 'vitest';

export interface MockRequestOptions {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
}

export interface HandlerResult {
  status: number;
  json: unknown;
  headers: Record<string, string | string[] | number | undefined>;
  headersSent: boolean;
  body: unknown;
}

export function createMockRequest(options: MockRequestOptions = {}): NextApiRequest {
  const cookieHeader = options.cookies
    ? Object.entries(options.cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ')
    : undefined;

  const headers: Record<string, string> = { ...options.headers };
  if (cookieHeader) {
    headers.cookie = cookieHeader;
  }

  return {
    method: options.method ?? 'GET',
    query: options.query ?? {},
    body: options.body,
    headers,
  } as unknown as NextApiRequest;
}

export function createMockResponse(): NextApiResponse & { _result: HandlerResult } {
  const result: HandlerResult = {
    status: 200,
    json: undefined,
    headers: {},
    headersSent: false,
    body: undefined,
  };

  const res = {
    _result: result,
    status(code: number) {
      result.status = code;
      return this;
    },
    json(data: unknown) {
      result.json = data;
      result.headersSent = true;
      return this;
    },
    writeHead(status: number, headers?: Record<string, string | number>) {
      result.status = status;
      if (headers) {
        result.headers = { ...result.headers, ...headers };
      }
      result.headersSent = true;
      return this;
    },
    send(data: unknown) {
      result.body = data;
      result.headersSent = true;
      return this;
    },
    setHeader(name: string, value: string | number) {
      result.headers[name] = value;
      return this;
    },
    get headersSent() {
      return result.headersSent;
    },
  };

  return res as unknown as NextApiResponse & { _result: HandlerResult };
}

export type ApiHandler = (req: NextApiRequest, res: NextApiResponse) => Promise<unknown> | unknown;

export async function invokeHandler(handler: ApiHandler, options: MockRequestOptions = {}): Promise<HandlerResult> {
  const req = createMockRequest(options);
  const res = createMockResponse();
  await handler(req, res);
  return res._result;
}

/** Minimal NextApiResponse mock for legacy apiResponses tests. */
export function createLegacyMockResponse() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as NextApiResponse;
}
