/**
 * v1 handler wiring for the workspace resource: validated, typed ctx → shared
 * controllers (which return clean DTOs).
 */
import { workspaceItemApiDoc, workspaceSettingsApiDoc } from '@lib/schemas/workspace';
import { defineApiHandlers } from '@lib/openapi/apiDoc';
import { ApiError } from '@lib/http/ApiError';
import { getRequestApiKeyPermissions } from '@lib/http/requestAuth';
import * as workspace from '@lib/api/controllers/workspace';
import { ALWAYS_AVAILABLE, STATUS_VIEW, withStatusExemption } from '@lib/entitlements/statusGate';

const itemRoutes = defineApiHandlers(workspaceItemApiDoc.operations, {
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
// Status view (GET) and deleting stay available in a read-only or suspended workspace (docs/ENTITLEMENTS.md "Status").
export const itemHandler = withStatusExemption({ GET: STATUS_VIEW, DELETE: ALWAYS_AVAILABLE }, itemRoutes);

export const settingsHandler = defineApiHandlers(workspaceSettingsApiDoc.operations, {
  GET: ({ workspace: ws }) => workspace.getWorkspaceSettings(ws),
  PUT: ({ workspace: ws, body }) => workspace.updateWorkspaceSetting(ws, body),
});
