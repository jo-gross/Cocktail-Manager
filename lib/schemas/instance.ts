/**
 * Zod schemas + ResourceApiDocs of the instance API (`/api/v1/instance/**`), the interface of the hosted control
 * plane. Master key only and instance-wide by design (no `{workspaceId}` scope). The shapes follow the contract
 * `contracts/instance-api.openapi.yaml` of the control plane; see docs/INSTANCE-API.md. Pure module.
 */
import { z } from '@lib/openapi/zod';
import { ApiTags } from '@lib/openapi/tags';
import { DateTimeString } from '@lib/schemas/common';
import { decodeWorkspaceCursor } from '@lib/instance/cursor';
import { MAX_ACTOR_LENGTH } from '@lib/instance/controlPlaneHeaders';
import type { ResourceApiDoc, RouteSpec } from '@lib/openapi/types';

export const INSTANCE_WORKSPACES_DEFAULT_LIMIT = 50;
export const INSTANCE_WORKSPACES_MAX_LIMIT = 200;
/** Users per search response; the contract has no paging for the search. */
export const INSTANCE_USERS_MAX_RESULTS = 50;
const MAX_SEARCH_LENGTH = 200;

const NullableDateTime = DateTimeString.nullable();

/** Documents the read header of the contract (`components.parameters.Actor`). */
export const InstanceReadHeadersSchema = z.object({
  'X-CM-Actor': z
    .string()
    .max(MAX_ACTOR_LENGTH)
    .optional()
    .openapi({ description: 'Email of the acting control plane administrator. Reads do not write it anywhere.' }),
});

const SearchText = z.string().trim().max(MAX_SEARCH_LENGTH);

export const InstanceInfoSchema = z
  .object({
    apiVersion: z.literal('1'),
    appVersion: z.string(),
    commit: z.string().nullable(),
    capabilities: z
      .array(z.string())
      .openapi({ description: 'Served capabilities; known values are instance.read, entitlements, announcements, support.write.' }),
    entitlementsMode: z.enum(['off', 'managed']).openapi({ description: 'Value of `ENTITLEMENTS_MODE` (invalid values count as `off`).' }),
    migrationsReady: z.boolean().openapi({ description: 'Database reachable and every migration of this build applied (as `/api/health/ready`).' }),
    chromiumAvailable: z.boolean().openapi({ description: 'A Chromium (PDF) service is configured.' }),
    counts: z.object({
      workspaces: z.number().int().min(0).openapi({ description: 'Workspaces the inventory lists (without template and demo workspaces).' }),
      users: z.number().int().min(0),
    }),
  })
  .openapi('InstanceInfo');

export const InstanceUsageCountsSchema = z
  .object({
    cocktails: z.number().int().min(0).openapi({ description: 'Cocktails that are not archived.' }),
    members: z.number().int().min(0),
    calculations: z.number().int().min(0),
    guestMenusPublished: z.number().int().min(0).openapi({ description: 'Guest menus with a published version.' }),
    signageScreens: z.number().int().min(0).openapi({ description: 'Configured monitor formats (landscape, portrait).' }),
    apiKeys: z.number().int().min(0).openapi({ description: 'Workspace API keys that are neither revoked nor expired.' }),
  })
  .openapi('InstanceUsageCounts');

export const InstanceOwnerRefSchema = z
  .object({
    id: z.string(),
    email: z.string().openapi({ description: 'Empty string if the user has no email.' }),
    name: z.string().openapi({ description: 'Empty string if the user has no name.' }),
  })
  .openapi('InstanceOwnerRef');

export const InstanceEntitlementRefSchema = z
  .object({
    version: z.number().int().min(0),
    hash: z.string(),
    planKey: z.string(),
  })
  .openapi('InstanceEntitlementRef');

export const InstanceWorkspaceSummarySchema = z
  .object({
    id: z.string(),
    name: z.string(),
    createdAt: NullableDateTime,
    updatedAt: NullableDateTime.openapi({ description: 'Last change of the workspace, its members and roles or its settings (not of its content).' }),
    owner: InstanceOwnerRefSchema.nullable().openapi({ description: 'The longest-registered owner, or null for a workspace without owner.' }),
    memberCount: z.number().int().min(0),
    lastActivityAt: NullableDateTime.openapi({ description: 'Newest audit log entry or member visit.' }),
    usage: InstanceUsageCountsSchema,
    entitlement: InstanceEntitlementRefSchema.nullable().openapi({ description: 'Applied entitlement snapshot; always null in this version.' }),
  })
  .openapi('InstanceWorkspaceSummary');

export const InstanceWorkspaceMemberSchema = z
  .object({
    userId: z.string(),
    email: z.string(),
    name: z.string(),
    role: z.string().openapi({ description: '`OWNER`, `ADMIN`, `MANAGER` or `USER`.' }),
    lastOpened: NullableDateTime,
  })
  .openapi('InstanceWorkspaceMember');

export const InstancePendingJoinRequestSchema = z
  .object({
    userId: z.string(),
    email: z.string(),
    name: z.string(),
    createdAt: DateTimeString,
  })
  .openapi('InstancePendingJoinRequest');

export const InstanceWorkspaceDetailSchema = InstanceWorkspaceSummarySchema.extend({
  members: z.array(InstanceWorkspaceMemberSchema),
  template: z.object({ key: z.string() }).nullable().openapi({ description: 'Template key if the workspace itself is a template workspace, otherwise null.' }),
  pendingJoinRequests: z.array(InstancePendingJoinRequestSchema),
}).openapi('InstanceWorkspaceDetail');

export const InstanceUserWorkspaceSchema = z.object({ id: z.string(), name: z.string(), role: z.string() }).openapi('InstanceUserWorkspace');

export const InstanceUserSchema = z
  .object({
    id: z.string(),
    email: z.string(),
    name: z.string(),
    createdAt: DateTimeString,
    providers: z.array(z.string()).openapi({ description: 'Login providers, e.g. `google`, `custom_oidc`, `credential`.' }),
    workspaces: z.array(InstanceUserWorkspaceSchema),
    activeSessions: z.number().int().min(0).openapi({ description: 'Sessions that have not expired.' }),
  })
  .openapi('InstanceUser');

export const InstanceWorkspaceListQuerySchema = z.object({
  cursor: z
    .string()
    .max(400)
    .refine((value) => decodeWorkspaceCursor(value) !== null, 'Invalid cursor')
    .optional()
    .openapi({ description: 'Opaque cursor returned as `pagination.nextCursor`.' }),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(INSTANCE_WORKSPACES_MAX_LIMIT)
    .default(INSTANCE_WORKSPACES_DEFAULT_LIMIT)
    .openapi({ description: `Items per page (1–${INSTANCE_WORKSPACES_MAX_LIMIT}).` }),
  updatedSince: z.iso
    .datetime({ offset: true })
    .optional()
    .openapi({ description: 'Only workspaces whose `updatedAt` is at or after this ISO 8601 timestamp.' }),
  q: SearchText.optional().openapi({ description: 'Case-insensitive search in the workspace name and the owner email.' }),
});

export const InstanceWorkspaceIdParam = z.object({
  id: z.string().min(1).max(128).openapi({ description: 'Workspace ID' }),
});

export const InstanceUserSearchQuerySchema = z.object({
  q: SearchText.optional().openapi({
    description: `Case-insensitive search in email and name; without \`q\` the first users by email. At most ${INSTANCE_USERS_MAX_RESULTS} results.`,
  }),
});

export type InstanceInfoDto = z.infer<typeof InstanceInfoSchema>;
export type InstanceUsageCounts = z.infer<typeof InstanceUsageCountsSchema>;
export type InstanceWorkspaceSummaryDto = z.infer<typeof InstanceWorkspaceSummarySchema>;
export type InstanceWorkspaceDetailDto = z.infer<typeof InstanceWorkspaceDetailSchema>;
export type InstanceUserDto = z.infer<typeof InstanceUserSchema>;
export type InstanceWorkspaceListQuery = z.infer<typeof InstanceWorkspaceListQuerySchema>;
export type InstanceUserSearchQuery = z.infer<typeof InstanceUserSearchQuerySchema>;

/** Common part of every instance operation: master key only, instance-wide, documented control plane headers. */
const instanceOperation: Pick<RouteSpec, 'roles' | 'permission' | 'auth' | 'headers'> = {
  roles: [],
  permission: null,
  auth: 'master',
  headers: InstanceReadHeadersSchema,
};

export const instanceApiDoc = {
  basePath: '/instance',
  operations: {
    GET: {
      ...instanceOperation,
      tags: [ApiTags.instanceCore],
      summary: 'Instance metadata and capabilities',
      description: 'Version, served capabilities, entitlement mode, readiness and counts. The control plane detects the instance API with this call.',
      response: InstanceInfoSchema,
    },
  },
} satisfies ResourceApiDoc;

export const instanceWorkspacesCollectionApiDoc = {
  basePath: '/instance/workspaces',
  operations: {
    GET: {
      ...instanceOperation,
      tags: [ApiTags.instanceWorkspaces],
      summary: 'List workspaces of the instance',
      description:
        'Every workspace of the instance except template and demo workspaces, ordered by ID, with owner, member count, last activity and ' +
        'usage. Cursor-paginated: the response is `{ data, pagination: { nextCursor } }`.',
      query: InstanceWorkspaceListQuerySchema,
      response: z.array(InstanceWorkspaceSummarySchema),
      pagination: 'cursor',
    },
  },
} satisfies ResourceApiDoc;

export const instanceWorkspacesItemApiDoc = {
  basePath: '/instance/workspaces/{id}',
  operations: {
    GET: {
      ...instanceOperation,
      tags: [ApiTags.instanceWorkspaces],
      summary: 'Get a workspace of the instance',
      description: 'Summary plus members with roles, template mark and open join requests. Also serves template and demo workspaces.',
      params: InstanceWorkspaceIdParam,
      response: InstanceWorkspaceDetailSchema,
      errorResponses: { 404: 'Workspace not found.' },
    },
  },
} satisfies ResourceApiDoc;

export const instanceUsersCollectionApiDoc = {
  basePath: '/instance/users',
  operations: {
    GET: {
      ...instanceOperation,
      tags: [ApiTags.instanceUsers],
      summary: 'Search users of the instance',
      description: 'Users with login providers, workspace memberships and the number of active sessions.',
      query: InstanceUserSearchQuerySchema,
      response: z.array(InstanceUserSchema),
    },
  },
} satisfies ResourceApiDoc;
