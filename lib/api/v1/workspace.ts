/**
 * v1 handler wiring for the workspace resource: validated, typed ctx → shared
 * controllers (which return clean DTOs).
 */
import { workspaceItemApiDoc, workspaceSettingsApiDoc } from '@lib/schemas/workspace';
import { defineApiHandlers } from '@lib/openapi/apiDoc';
import * as workspace from '@lib/api/controllers/workspace';

export const itemHandler = defineApiHandlers(workspaceItemApiDoc.operations, {
  GET: ({ workspace: ws, user }) => workspace.getWorkspace(ws, user),
  PUT: ({ workspace: ws, body }) => workspace.updateWorkspace(ws, body),
  DELETE: ({ workspace: ws }) => workspace.deleteWorkspace(ws),
});

export const settingsHandler = defineApiHandlers(workspaceSettingsApiDoc.operations, {
  GET: ({ workspace: ws }) => workspace.getWorkspaceSettings(ws),
  PUT: ({ workspace: ws, body }) => workspace.updateWorkspaceSetting(ws, body),
});
