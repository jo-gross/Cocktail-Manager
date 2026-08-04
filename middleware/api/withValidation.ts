/**
 * v1 validation middleware. Slots between withWorkspacePermission and the
 * handler: validates params/query/body with the route's zod schemas, passes a
 * typed ctx to the handler, and standardizes success/error envelopes.
 *
 * Pages Router note: path params AND the query string both live in req.query,
 * so `params` and `query` are validated against the same source (different keys).
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import type { User, Workspace } from '@generated/prisma/client';
import { constants as HttpStatus } from 'http2';
import type { z } from 'zod';
import type { HandlerCtx, RouteSpec } from '@lib/openapi/types';
import { sendFail, sendOk } from '@lib/http/responses';
import { ApiError } from '@lib/http/ApiError';

function parsePart(schema: z.ZodTypeAny | undefined, data: unknown) {
  if (!schema) return { ok: true as const, data: undefined };
  const result = schema.safeParse(data);
  if (!result.success) return { ok: false as const, issues: result.error.issues };
  return { ok: true as const, data: result.data };
}

export function withValidation<S extends RouteSpec>(spec: S, handler: (ctx: HandlerCtx<S>) => unknown | Promise<unknown>) {
  return async (req: NextApiRequest, res: NextApiResponse, user: User, workspace: Workspace) => {
    const parts: Array<[keyof HandlerCtx<S>, ReturnType<typeof parsePart>]> = [
      ['params', parsePart(spec.params, req.query)],
      ['query', parsePart(spec.query, req.query)],
      ['body', parsePart(spec.body, req.body)],
    ];

    for (const [where, result] of parts) {
      if (!result.ok) {
        return sendFail(res, HttpStatus.HTTP_STATUS_BAD_REQUEST, 'VALIDATION_ERROR', `Invalid request ${String(where)}`, result.issues);
      }
    }

    const ctx = {
      req,
      res,
      user,
      workspace,
      params: parts[0][1].data,
      query: parts[1][1].data,
      body: parts[2][1].data,
    } as HandlerCtx<S>;

    try {
      const result = await handler(ctx);
      if (!res.headersSent && result !== undefined) {
        return sendOk(res, result, spec.status ?? HttpStatus.HTTP_STATUS_OK);
      }
      return undefined;
    } catch (error) {
      if (error instanceof ApiError) {
        return sendFail(res, error.status, error.code, error.message, error.issues);
      }
      console.error('withValidation handler error:', error);
      if (!res.headersSent) {
        return sendFail(res, HttpStatus.HTTP_STATUS_INTERNAL_SERVER_ERROR, 'INTERNAL_ERROR', 'Internal error occurred!');
      }
      return undefined;
    }
  };
}
