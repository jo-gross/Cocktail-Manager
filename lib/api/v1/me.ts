/**
 * v1 handler for GET /api/v1/me — token identity / introspection.
 *
 * Unlike the resource handlers, /me has no workspaceId path param: it resolves
 * the workspace FROM the API token (the JWT carries it) or reports the instance
 * master key. It is therefore hand-wired (no withWorkspacePermission) but keeps
 * the same CORS + method + { data } envelope conventions as the rest of v1.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import HTTPMethod from 'http-method-enum';
import { Permission } from '@generated/prisma/client';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { withCors } from '@middleware/api/withCors';
import { authenticateApiKey, checkMasterApiKey } from '@middleware/api/jwtApiKeyMiddleware';
import { sendOk, sendFail } from '@lib/http/responses';
import type { MeDto } from '@lib/schemas/me';

const getMe = async (req: NextApiRequest, res: NextApiResponse) => {
  // Instance master key: full access, not scoped to a single workspace.
  if (checkMasterApiKey(req)) {
    const identity: MeDto = {
      workspaceId: null,
      workspace: null,
      permissions: Object.values(Permission),
      apiKey: { id: 'master', name: 'Master API Key' },
      isMaster: true,
    };
    return sendOk(res, identity);
  }

  const auth = await authenticateApiKey(req);
  if (!auth) {
    return sendFail(res, 401, 'UNAUTHORIZED', 'Missing or invalid API key');
  }

  const identity: MeDto = {
    workspaceId: auth.workspace.id,
    workspace: { id: auth.workspace.id, name: auth.workspace.name },
    permissions: auth.permissions,
    apiKey: { id: auth.apiKey.id, name: auth.apiKey.name },
    isMaster: false,
  };
  return sendOk(res, identity);
};

export const meHandler = withCors(withHttpMethods({ [HTTPMethod.GET]: getMe }), [HTTPMethod.GET]);
