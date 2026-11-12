/**
 * v1 handler wiring for workspace users: validated, typed ctx → shared
 * controllers (which return clean DTOs).
 */
import type { NextApiRequest } from 'next';
import type { User } from '@generated/prisma/client';
import { workspaceUsersCollectionApiDoc, workspaceUsersItemApiDoc } from '@lib/schemas/workspaceUsers';
import { defineApiHandlers } from '@lib/openapi/apiDoc';
import { getRequestApiKeyPermissions } from '@lib/http/requestAuth';
import * as workspaceUsers from '@lib/api/controllers/workspaceUsers';

/** API-key requests act as the key's creator; the controller must not grant them the creator's owner rights. */
function membershipActor(req: NextApiRequest, user: User): workspaceUsers.MembershipActor {
  const apiKeyPermissions = getRequestApiKeyPermissions(req);
  if (apiKeyPermissions === 'all') return { kind: 'master', user };
  if (apiKeyPermissions) return { kind: 'apiKey', user };
  return { kind: 'session', user };
}

export const collectionHandler = defineApiHandlers(workspaceUsersCollectionApiDoc.operations, {
  GET: ({ workspace }) => workspaceUsers.listWorkspaceUsers(workspace),
});

export const itemHandler = defineApiHandlers(workspaceUsersItemApiDoc.operations, {
  PUT: ({ req, workspace, user, params, body }) => workspaceUsers.updateWorkspaceUser(workspace, membershipActor(req, user), params.userId, body),
  DELETE: ({ req, workspace, user, params }) => workspaceUsers.deleteWorkspaceUser(workspace, membershipActor(req, user), params.userId),
});
