/**
 * Handler wiring of the portal handoff (docs/ENTITLEMENTS.md "Portal handoff"). `sessionOnly`, so API keys and the
 * master key are refused; exempt from the status gate, so a read-only or suspended workspace can still pay.
 */
import { defineApiHandlers } from '@lib/openapi/apiDoc';
import { portalHandoffApiDoc } from '@lib/schemas/portalHandoff';
import { HANDOFF_STATUS_EXEMPTION, withStatusExemption } from '@lib/entitlements/statusGate';
import * as portalHandoff from '@lib/api/controllers/portalHandoff';

export const handoffHandler = withStatusExemption(
  HANDOFF_STATUS_EXEMPTION,
  defineApiHandlers(portalHandoffApiDoc.operations, {
    POST: ({ res, workspace, user, body }) => portalHandoff.createPortalHandoff(res, workspace, user, body),
  }),
);
