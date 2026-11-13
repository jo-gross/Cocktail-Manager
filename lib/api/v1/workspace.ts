/**
 * v1 handler wiring for the workspace resource: validated, typed ctx → shared
 * controllers (which return clean DTOs).
 */
import { workspaceItemApiDoc, workspaceSettingsApiDoc } from '@lib/schemas/workspace';
import { defineApiHandlers } from '@lib/openapi/apiDoc';
import { ApiError } from '@lib/http/ApiError';
import { getRequestApiKeyPermissions } from '@lib/http/requestAuth';
import * as workspace from '@lib/api/controllers/workspace';

export const itemHandler = defineApiHandlers(workspaceItemApiDoc.operations, {
  GET: ({ workspace: ws, user }) => workspace.getWorkspace(ws, user),
  PUT: ({ req, workspace: ws, body }) => {
    // The public slug publishes guest menus under a new URL — the GUEST_MENUS_PUBLISH scope.
    const apiKeyPermissions = getRequestApiKeyPermissions(req);
    if (body.publicSlug !== undefined && Array.isArray(apiKeyPermissions) && !apiKeyPermissions.includes('GUEST_MENUS_PUBLISH')) {
      throw new ApiError(403, 'FORBIDDEN', 'API key does not have required permission GUEST_MENUS_PUBLISH');
    }
    return workspace.updateWorkspace(ws, body);
  },
  DELETE: ({ workspace: ws }) => workspace.deleteWorkspace(ws),
});

export const settingsHandler = defineApiHandlers(workspaceSettingsApiDoc.operations, {
  GET: ({ workspace: ws }) => workspace.getWorkspaceSettings(ws),
  PUT: ({ workspace: ws, body }) => workspace.updateWorkspaceSetting(ws, body),
});
