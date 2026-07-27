/**
 * Shared types for the versioned (/api/v1) API surface: a single `apiDoc`
 * object per route drives runtime validation, handler typing AND the OpenAPI
 * spec. See lib/openapi/apiDoc.ts (runtime) and scripts/generate-openapi.ts.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import type { Permission, Role, User, Workspace } from '@generated/prisma/client';
import type { z } from 'zod';

export type HttpVerb = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Non-JSON (binary) success response, e.g. image bytes. */
export interface RawResponse {
  contentTypes: string[];
  description?: string;
}

export interface RouteSpec {
  /** Session roles accepted (role hierarchy escalates in withWorkspacePermission). */
  roles: Role[];
  /** API-key permission scope required, or null for endpoints that accept any valid session/key. */
  permission: Permission | null;
  /**
   * When true, this operation is authenticated by a logged-in workspace-member SESSION only — API keys
   * (workspace keys AND the instance master key) are rejected. Use for operations that act on the caller's
   * own identity or write a real-user FK: `leave`, api-key create/delete, join-request self-cancel.
   */
  sessionOnly?: boolean;
  summary: string;
  description?: string;
  tags: string[];
  /** Path params (read from req.query in Pages Router), e.g. workspaceId, id. */
  params?: z.ZodTypeAny;
  /** Query-string params. */
  query?: z.ZodTypeAny;
  /** JSON request body. */
  body?: z.ZodTypeAny;
  /** Success response payload (documented; wrapped in { data } by ok()). Required unless rawResponse is set. */
  response?: z.ZodTypeAny;
  /** Binary/non-JSON success response instead of a JSON `data` envelope. */
  rawResponse?: RawResponse;
  /** Success status code (default 200). */
  status?: number;
  /** Extra documented error responses, e.g. { 404: 'Not found', 409: 'In use' }. */
  errorResponses?: Partial<Record<number, string>>;
}

export type ApiDoc = Partial<Record<HttpVerb, RouteSpec>>;

export interface ResourceApiDoc {
  /**
   * URL path WITHOUT the /api or /api/v1 prefix, using {param} templating,
   * e.g. '/workspaces/{workspaceId}/glasses'. The generator emits it at
   * /api/v1{basePath} (canonical) and, if legacyPath, /api{basePath} (deprecated).
   */
  basePath: string;
  /** Also emit a deprecated mirror at /api{basePath} (default true). */
  legacyPath?: boolean;
  operations: ApiDoc;
}

type InferOr<S, D = undefined> = S extends z.ZodTypeAny ? z.infer<S> : D;

export interface HandlerCtx<S extends RouteSpec> {
  req: NextApiRequest;
  res: NextApiResponse;
  user: User;
  workspace: Workspace;
  params: InferOr<S['params']>;
  query: InferOr<S['query']>;
  body: InferOr<S['body']>;
}

export type Handler<S extends RouteSpec> = (ctx: HandlerCtx<S>) => unknown | Promise<unknown>;

export type Handlers<D extends ApiDoc> = {
  [M in keyof D]: D[M] extends RouteSpec ? Handler<D[M]> : never;
};

/** Type guard used by the generator to pick ResourceApiDoc exports from a module. */
export function isResourceApiDoc(value: unknown): value is ResourceApiDoc {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ResourceApiDoc).basePath === 'string' &&
    typeof (value as ResourceApiDoc).operations === 'object'
  );
}
