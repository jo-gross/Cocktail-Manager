/**
 * Zod schema + ResourceApiDoc for leaving a workspace (v1). Pure module (zod only).
 * This acts on the caller's OWN membership (keyed on `user.id`), so it is `sessionOnly`
 * — API keys (workspace or the instance master key) are rejected.
 */
import { z } from '@lib/openapi/zod';
import { WorkspaceIdParam } from '@lib/schemas/common';
import { ApiTags } from '@lib/openapi/tags';
import type { ResourceApiDoc } from '@lib/openapi/types';

export const LeaveResultSchema = z.object({ ok: z.boolean() }).openapi('LeaveResult');

export const leaveApiDoc = {
  basePath: '/workspaces/{workspaceId}/leave',
  operations: {
    POST: {
      roles: ['USER'],
      permission: null,
      sessionOnly: true,
      tags: [ApiTags.workspaceMembership],
      summary: 'Leave workspace',
      description: 'Removes the calling user from the workspace. Session-only — API keys are not accepted. The last owner cannot leave.',
      params: WorkspaceIdParam,
      response: LeaveResultSchema,
      errorResponses: { 409: 'The caller is the last owner of the workspace (`LAST_OWNER`).' },
    },
  },
} satisfies ResourceApiDoc;
