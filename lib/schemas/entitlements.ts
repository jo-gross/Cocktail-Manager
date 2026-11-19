/**
 * Zod schemas + ResourceApiDocs of the entitlements (docs/ENTITLEMENTS.md):
 * - the snapshot pushes of the control plane (`PUT /api/v1/instance/entitlements/default`,
 *   `PUT /api/v1/instance/workspaces/{id}/entitlements`; master key only, contract `contracts/instance-api.openapi.yaml`)
 * - the plan of a workspace for its members (`GET /api/v1/workspaces/{workspaceId}/entitlement`).
 * Pure module.
 */
import { z } from '@lib/openapi/zod';
import { ApiTags } from '@lib/openapi/tags';
import { WorkspaceIdParam } from '@lib/schemas/common';
import { InstanceUsageCountsSchema, InstanceWorkspaceIdParam, instanceWriteOperation } from '@lib/schemas/instance';
import { ENTITLEMENT_STATUSES, LocalizedNameSchema, SnapshotLimitsSchema, SnapshotWireSchema } from '@lib/entitlements/snapshot';
import type { ResourceApiDoc } from '@lib/openapi/types';

export const EntitlementApplyResultSchema = z
  .object({
    applied: z.boolean().openapi({ description: 'The snapshot was stored (its version was higher than the stored one).' }),
    currentVersion: z.number().int().min(0).openapi({ description: 'Version the app holds now (0 without a snapshot).' }),
    currentHash: z.string().nullable().openapi({ description: 'Hash of the snapshot the app holds now, null without a snapshot.' }),
  })
  .openapi('EntitlementApplyResult');

export type EntitlementApplyResult = z.infer<typeof EntitlementApplyResultSchema>;

export const instanceDefaultEntitlementsApiDoc = {
  basePath: '/instance/entitlements/default',
  operations: {
    PUT: {
      ...instanceWriteOperation,
      tags: [ApiTags.instanceEntitlements],
      summary: 'Set the instance default snapshot',
      description:
        'The snapshot of every workspace without its own snapshot. Stored only when its `version` is higher than the stored one; an equal ' +
        'or lower version answers `applied: false` with 200. Enforced only with `ENTITLEMENTS_MODE=managed`.',
      body: SnapshotWireSchema,
      response: EntitlementApplyResultSchema,
      errorResponses: {
        400: 'Invalid snapshot or invalid control plane headers.',
        409: 'The `Idempotency-Key` was already used for another request (`IDEMPOTENCY_KEY_REUSED`).',
      },
    },
  },
} satisfies ResourceApiDoc;

export const instanceWorkspaceEntitlementsApiDoc = {
  basePath: '/instance/workspaces/{id}/entitlements',
  operations: {
    PUT: {
      ...instanceWriteOperation,
      tags: [ApiTags.instanceEntitlements],
      summary: 'Set the snapshot of a workspace',
      description:
        'Stored only when its `version` is higher than the stored one; an equal or lower version answers `applied: false` with 200. ' +
        'An applied snapshot is written to the audit log of the workspace with `X-CM-Actor` and `X-CM-Reason`.',
      params: InstanceWorkspaceIdParam,
      body: SnapshotWireSchema,
      response: EntitlementApplyResultSchema,
      errorResponses: {
        400: 'Invalid snapshot or invalid control plane headers.',
        404: 'Workspace not found.',
        409: 'The `Idempotency-Key` was already used for another request (`IDEMPOTENCY_KEY_REUSED`).',
      },
    },
  },
} satisfies ResourceApiDoc;

// ---------------------------------------------------------------------------
// Workspace plan (members)
// ---------------------------------------------------------------------------

export const WorkspacePlanSchema = z
  .object({
    planKey: z.string(),
    planName: LocalizedNameSchema,
    status: z.enum(ENTITLEMENT_STATUSES),
    billing: z.enum(['portal', 'contact']).openapi({ description: '`portal`: manage the subscription in the portal; `contact`: individual terms.' }),
    nextChangeAt: z.string().nullable(),
    limits: SnapshotLimitsSchema,
    features: z.array(z.string()),
    source: z.enum(['workspace', 'default']).openapi({ description: 'Own snapshot of the workspace or the instance default.' }),
  })
  .openapi('WorkspacePlan');

export const WorkspaceEntitlementDtoSchema = z
  .object({
    mode: z.enum(['off', 'managed']).openapi({ description: '`ENTITLEMENTS_MODE`; with `off` nothing is limited and `plan` and `usage` are null.' }),
    plan: WorkspacePlanSchema.nullable().openapi({ description: 'The plan that applies; null when nothing is limited (yet).' }),
    usage: InstanceUsageCountsSchema.nullable().openapi({ description: 'Usage per limit key; null with `ENTITLEMENTS_MODE=off`.' }),
  })
  .openapi('WorkspaceEntitlement');

export type WorkspaceEntitlementDto = z.infer<typeof WorkspaceEntitlementDtoSchema>;

export const workspaceEntitlementApiDoc = {
  basePath: '/workspaces/{workspaceId}/entitlement',
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'WORKSPACE_READ',
      tags: [ApiTags.workspacePlan],
      summary: 'Get the plan of the workspace',
      description: 'Plan name, status, limits, features and usage. Also answers in a suspended workspace (status view).',
      params: WorkspaceIdParam,
      response: WorkspaceEntitlementDtoSchema,
    },
  },
} satisfies ResourceApiDoc;
