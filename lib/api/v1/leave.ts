/**
 * v1 handler wiring for leaving a workspace: validated, typed ctx → shared controller.
 * The apiDoc marks this `sessionOnly`, so defineApiHandlers routes it through the
 * session-only middleware (no API-key auth).
 */
import { leaveApiDoc } from '@lib/schemas/leave';
import { defineApiHandlers } from '@lib/openapi/apiDoc';
import * as leave from '@lib/api/controllers/leave';

export const leaveHandler = defineApiHandlers(leaveApiDoc.operations, {
  POST: ({ workspace, user }) => leave.leaveWorkspace(workspace, user),
});
