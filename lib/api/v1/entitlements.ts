/**
 * Handler wiring of the entitlements: snapshot pushes of the control plane (instance API, master key only) and the
 * plan of a workspace. See docs/ENTITLEMENTS.md.
 */
import { defineApiHandlers } from '@lib/openapi/apiDoc';
import { instanceDefaultEntitlementsApiDoc, instanceWorkspaceEntitlementsApiDoc, workspaceEntitlementApiDoc } from '@lib/schemas/entitlements';
import { STATUS_VIEW, withStatusExemption } from '@lib/entitlements/statusGate';
import * as entitlements from '@lib/api/controllers/entitlements';

export const instanceDefaultHandler = defineApiHandlers(instanceDefaultEntitlementsApiDoc.operations, {
  PUT: ({ req, body }) => entitlements.putDefaultEntitlements(req, body),
});

export const instanceWorkspaceHandler = defineApiHandlers(instanceWorkspaceEntitlementsApiDoc.operations, {
  PUT: ({ req, params, body }) => entitlements.putWorkspaceEntitlements(req, params.id, body),
});

/** Part of the status view of a suspended workspace. */
export const workspaceHandler = withStatusExemption(
  { GET: STATUS_VIEW },
  defineApiHandlers(workspaceEntitlementApiDoc.operations, {
    GET: ({ workspace }) => entitlements.getWorkspaceEntitlement(workspace),
  }),
);
