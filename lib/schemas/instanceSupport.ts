/**
 * Zod schemas + ResourceApiDocs of the support writes of the instance API (capability `support.write`, master key
 * only): ownership transfer and session revocation. Deleting a workspace is declared with the workspace item in
 * `lib/schemas/instance.ts`. The shapes follow the contract `contracts/instance-api.openapi.yaml` of the control plane;
 * see docs/INSTANCE-API.md. Pure module.
 */
import { z } from '@lib/openapi/zod';
import { ApiTags } from '@lib/openapi/tags';
import { InstanceWorkspaceIdParam, instanceWriteOperation } from '@lib/schemas/instance';
import type { ResourceApiDoc } from '@lib/openapi/types';

export const InstanceTransferOwnershipInputSchema = z
  .object({
    userId: z.string().min(1).max(128).openapi({ description: 'User ID of the new owner; must be a member of the workspace.' }),
  })
  .openapi('InstanceTransferOwnershipInput');

export const InstanceTransferOwnershipResultSchema = z.object({ ownerId: z.string() }).openapi('InstanceTransferOwnershipResult');

export const InstanceUserIdParam = z.object({
  id: z.string().min(1).max(128).openapi({ description: 'User ID' }),
});

export const InstanceRevokeSessionsResultSchema = z
  .object({ revoked: z.number().int().min(0).openapi({ description: 'Sessions that had not expired.' }) })
  .openapi('InstanceRevokeSessionsResult');

export type InstanceTransferOwnershipInput = z.infer<typeof InstanceTransferOwnershipInputSchema>;

const IDEMPOTENCY_CONFLICT = 'The Idempotency-Key was already used for another request.';

export const instanceWorkspacesTransferOwnershipApiDoc = {
  basePath: '/instance/workspaces/{id}/transfer-ownership',
  operations: {
    POST: {
      ...instanceWriteOperation,
      tags: [ApiTags.instanceWorkspaces],
      summary: 'Transfer workspace ownership to a member',
      description:
        'Makes the member the only owner of the workspace; every other owner becomes `ADMIN`. The role changes are written to the audit log of ' +
        'the workspace. Capability `support.write`.',
      params: InstanceWorkspaceIdParam,
      body: InstanceTransferOwnershipInputSchema,
      response: InstanceTransferOwnershipResultSchema,
      errorResponses: { 404: 'Workspace not found, or the user is not a member of it.', 409: IDEMPOTENCY_CONFLICT },
    },
  },
} satisfies ResourceApiDoc;

export const instanceUsersSessionsApiDoc = {
  basePath: '/instance/users/{id}/sessions',
  operations: {
    DELETE: {
      ...instanceWriteOperation,
      tags: [ApiTags.instanceUsers],
      summary: 'Revoke all sessions of a user',
      description:
        'Deletes every session of the user, who has to sign in again. A browser can keep working for up to five minutes (session cookie cache). ' +
        'Capability `support.write`.',
      params: InstanceUserIdParam,
      response: InstanceRevokeSessionsResultSchema,
      errorResponses: { 404: 'User not found.', 409: IDEMPOTENCY_CONFLICT },
    },
  },
} satisfies ResourceApiDoc;
