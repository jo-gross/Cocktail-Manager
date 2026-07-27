/**
 * Zod schema + ResourceApiDoc for leaving a workspace (v1). Pure module (zod only).
 * This acts on the caller's OWN membership (keyed on `user.id`), so it is `sessionOnly`
 * — API keys (workspace or the instance master key) are rejected.
 */
import { z } from '@lib/openapi/zod';
import { WorkspaceIdParam } from '@lib/schemas/common';
import type { ResourceApiDoc } from '@lib/openapi/types';

export const LeaveResultSchema = z.object({ ok: z.boolean() }).openapi('LeaveResult');

export const leaveApiDoc = {
  basePath: '/workspaces/{workspaceId}/leave',
  legacyPath: true,
  operations: {
    POST: {
      roles: ['USER'],
      permission: null,
      sessionOnly: true,
      tags: ['Workspace'],
      summary: 'Leave workspace',
      description: 'Removes the calling user from the workspace. Session-only — API keys are not accepted.',
      params: WorkspaceIdParam,
      response: LeaveResultSchema,
    },
  },
} satisfies ResourceApiDoc;
