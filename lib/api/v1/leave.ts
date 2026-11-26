/**
 * v1 handler wiring for leaving a workspace: validated, typed ctx → shared controller.
 * The apiDoc marks this `sessionOnly`, so defineApiHandlers routes it through the
 * session-only middleware (no API-key auth).
 */
import { leaveApiDoc } from '@lib/schemas/leave';
import { defineApiHandlers } from '@lib/openapi/apiDoc';
import * as leave from '@lib/api/controllers/leave';
import { ALWAYS_AVAILABLE, withStatusExemption } from '@lib/entitlements/statusGate';

const leaveRoutes = defineApiHandlers(leaveApiDoc.operations, {
  POST: ({ workspace, user }) => leave.leaveWorkspace(workspace, user),
});
// Leaving stays possible in a read-only or suspended workspace (docs/ENTITLEMENTS.md "Status").
export const leaveHandler = withStatusExemption({ POST: ALWAYS_AVAILABLE }, leaveRoutes);
