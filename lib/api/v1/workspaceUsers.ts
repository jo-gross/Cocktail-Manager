/**
 * v1 handler wiring for workspace users: validated, typed ctx → shared
 * controllers (which return clean DTOs).
 */
import { workspaceUsersCollectionApiDoc, workspaceUsersItemApiDoc } from '@lib/schemas/workspaceUsers';
import { defineApiHandlers } from '@lib/openapi/apiDoc';
import * as workspaceUsers from '@lib/api/controllers/workspaceUsers';

export const collectionHandler = defineApiHandlers(workspaceUsersCollectionApiDoc.operations, {
  GET: ({ workspace }) => workspaceUsers.listWorkspaceUsers(workspace),
});

export const itemHandler = defineApiHandlers(workspaceUsersItemApiDoc.operations, {
  PUT: ({ workspace, user, params, body }) => workspaceUsers.updateWorkspaceUser(workspace, user, params.userId, body),
  DELETE: ({ workspace, user, params }) => workspaceUsers.deleteWorkspaceUser(workspace, user, params.userId),
});
