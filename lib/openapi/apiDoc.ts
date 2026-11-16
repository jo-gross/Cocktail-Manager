/**
 * Composes the existing middleware chain from an `apiDoc`:
 *   withCors(withHttpMethods({ M: withWorkspacePermission(roles, permission, withValidation(spec, handler)) }))
 *
 * The SAME apiDoc is read by scripts/generate-openapi.ts to emit the OpenAPI
 * spec — one declaration drives runtime validation, handler typing and docs.
 *
 * withCors wraps the whole chain so cross-origin callers (the docs "Try it out"
 * console) get the required CORS headers and preflight (OPTIONS) responses.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import HTTPMethod from 'http-method-enum';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { withAuthentication, withWorkspacePermission, withWorkspaceSession } from '@middleware/api/authenticationMiddleware';
import { checkMasterApiKey } from '@middleware/api/jwtApiKeyMiddleware';
import { sendFail } from '@lib/http/responses';
import { MASTER_API_KEY_USER_ID } from '@lib/http/requestAuth';
import type { User, Workspace } from '@generated/prisma/client';
import { withValidation } from '@middleware/api/withValidation';
import { withCors } from '@middleware/api/withCors';
import type { ApiDoc, Handlers, RouteSpec } from '@lib/openapi/types';

const MASTER_USER: User = {
  id: MASTER_API_KEY_USER_ID,
  name: 'Master API Key',
  email: null,
  emailVerified: false,
  image: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

export function defineApiHandlers<D extends ApiDoc>(doc: D, handlers: Handlers<D>) {
  const methodMap: Partial<Record<HTTPMethod, (req: NextApiRequest, res: NextApiResponse) => Promise<unknown> | undefined>> = {};

  for (const method of Object.keys(doc) as Array<keyof D>) {
    const spec = doc[method] as RouteSpec;
    const handler = handlers[method] as Handlers<D>[keyof D];
    const validated = withValidation(spec, handler as never);
    // No workspace for user/master operations; their handlers never read ctx.workspace.
    const noWorkspace = undefined as unknown as Workspace;
    if (spec.auth === 'user') {
      methodMap[method as unknown as HTTPMethod] = withAuthentication((req, res, user) => validated(req, res, user, noWorkspace));
    } else if (spec.auth === 'master') {
      methodMap[method as unknown as HTTPMethod] = async (req, res) => {
        if (!checkMasterApiKey(req)) return sendFail(res, 401, 'UNAUTHORIZED', 'Master API key required');
        return validated(req, res, MASTER_USER, noWorkspace);
      };
    } else {
      // sessionOnly ops reject API keys (workspace + instance master) — session-member auth only.
      methodMap[method as unknown as HTTPMethod] = spec.sessionOnly
        ? withWorkspaceSession(spec.roles, validated)
        : withWorkspacePermission(spec.roles, spec.permission, validated);
    }
  }

  return withCors(withHttpMethods(methodMap), Object.keys(methodMap));
}
