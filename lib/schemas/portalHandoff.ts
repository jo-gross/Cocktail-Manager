/**
 * Zod schema + ResourceApiDoc of the portal handoff (`POST /api/v1/workspaces/{workspaceId}/portal/handoff`,
 * docs/ENTITLEMENTS.md "Portal handoff", contract `contracts/portal-handoff.md` of the control plane). Pure module.
 */
import { z } from '@lib/openapi/zod';
import { ApiTags } from '@lib/openapi/tags';
import { WorkspaceIdParam } from '@lib/schemas/common';
import { HANDOFF_INTENTS, HANDOFF_LOCALES } from '@lib/portal/constants';
import type { ResourceApiDoc } from '@lib/openapi/types';

export const PortalHandoffInputSchema = z
  .object({
    intent: z.enum(HANDOFF_INTENTS).openapi({ description: '`manage` ("Abo verwalten") or `upgrade` (limit dialog); the portal picks the page.' }),
    locale: z
      .enum(HANDOFF_LOCALES)
      .optional()
      .openapi({ description: 'UI language for the portal pages; default: the language setting of the user, otherwise `de`.' }),
  })
  .openapi('PortalHandoffInput');

export type PortalHandoffInput = z.infer<typeof PortalHandoffInputSchema>;

export const PortalHandoffResultSchema = z
  .object({
    url: z.string().openapi({
      description: '`<PORTAL_URL>/sso?token=…` with a fresh token (single use, valid for 120 s). The client navigates there at once.',
    }),
  })
  .openapi('PortalHandoffResult');

export type PortalHandoffResult = z.infer<typeof PortalHandoffResultSchema>;

export const portalHandoffApiDoc = {
  basePath: '/workspaces/{workspaceId}/portal/handoff',
  operations: {
    POST: {
      roles: ['OWNER'],
      permission: null,
      sessionOnly: true,
      tags: [ApiTags.workspacePlan],
      summary: 'Open the customer portal',
      description:
        'Signs a short-lived token for the customer portal of the hosting provider and answers the URL that signs the owner in on the ' +
        'page of this workspace there. Hosted instances only (`ENTITLEMENTS_MODE=managed` with `PORTAL_HANDOFF_PRIVATE_KEY` and ' +
        '`PORTAL_URL`). Owners with a verified email address only; session only. Also available in a read-only or suspended workspace.',
      params: WorkspaceIdParam,
      body: PortalHandoffInputSchema,
      response: PortalHandoffResultSchema,
      errorResponses: {
        403: 'Below OWNER, or the email address of the user is not verified (`EMAIL_NOT_VERIFIED`).',
        404: 'The instance offers no portal handoff (`PORTAL_HANDOFF_UNAVAILABLE`).',
      },
    },
  },
} satisfies ResourceApiDoc;
