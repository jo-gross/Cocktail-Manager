/**
 * Zod schemas + ResourceApiDocs for the Workspace resource (v1).
 * Pure module (zod + type-only enums) so scripts/generate-openapi.ts can import
 * it without pulling the Prisma runtime. Responses describe the clean public DTO
 * (see lib/api/dto/workspace.ts), NOT the raw Prisma shape.
 */
import { z } from '@lib/openapi/zod';
import { WorkspaceIdParam, DateTimeString, DeletionResult } from '@lib/schemas/common';
import { ApiTags } from '@lib/openapi/tags';
import type { ResourceApiDoc } from '@lib/openapi/types';
import { validateWorkspaceSettingValue } from '@lib/workspace/workspaceLocaleSettings';
import { ImageDataUriSchema } from '@lib/images/imageSchema';

/** Workspace display name: trimmed, 1–100 characters. */
export const WorkspaceNameSchema = z.string().trim().min(1).max(100);

const RoleEnum = z.enum(['OWNER', 'ADMIN', 'MANAGER', 'USER']).openapi('WorkspaceRole');

/** Known workspace setting keys (mirrors Prisma WorkspaceSettingKey). */
const WorkspaceSettingKeyEnum = z
  .enum(['translations', 'usePrices', 'statisticDayStartTime', 'timezone', 'currency', 'contentLocales'])
  .openapi('WorkspaceSettingKey');

/** A workspace member — public user fields plus their role in this workspace. */
export const WorkspaceMemberDtoSchema = z
  .object({
    userId: z.string(),
    name: z.string().nullable(),
    email: z.string().nullable(),
    image: z.string().nullable(),
    role: RoleEnum,
    lastOpened: DateTimeString.nullable().openapi({ description: 'When the member last opened this workspace.' }),
  })
  .openapi('WorkspaceMember');

/** Workspace settings as a flat key→value map (values may be null). */
export const WorkspaceSettingsDtoSchema = z
  .record(WorkspaceSettingKeyEnum, z.string().nullable())
  .openapi('WorkspaceSettings', { description: 'Workspace settings keyed by setting name; values are strings or null.' });

/** Public workspace DTO — flat settings map, clean members, no PascalCase relations. */
export const WorkspaceDtoSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    image: z.string().nullable(),
    isDemo: z.boolean(),
    expiresAt: DateTimeString.nullable().openapi({ description: 'When a demo workspace expires, or null.' }),
    isExternallyManaged: z.boolean().openapi({ description: 'Whether membership/roles are managed via an external identity provider.' }),
    publicSlug: z.string().nullable().openapi({ description: 'Public slug for guest menus (`/m/{publicSlug}`), or null.' }),
    settings: WorkspaceSettingsDtoSchema,
    members: z.array(WorkspaceMemberDtoSchema),
  })
  .openapi('Workspace');

export type WorkspaceMemberDto = z.infer<typeof WorkspaceMemberDtoSchema>;
export type WorkspaceSettingsDto = z.infer<typeof WorkspaceSettingsDtoSchema>;
export type WorkspaceDto = z.infer<typeof WorkspaceDtoSchema>;

/** Public guest-menu slug (`/m/{publicSlug}`): lowercase a-z, 0-9 and single dashes. */
export const WORKSPACE_PUBLIC_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const WORKSPACE_PUBLIC_SLUG_MIN_LENGTH = 3;
export const WORKSPACE_PUBLIC_SLUG_MAX_LENGTH = 64;

/**
 * Slugs shaped like record ids (cuid / uuid) are reserved: `/m/{workspaceId}` must
 * always resolve to that workspace, so a slug must never be able to shadow an id.
 */
const RESERVED_PUBLIC_SLUG_PATTERNS = [/^c[a-z0-9]{20,}$/, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/];

export function isReservedPublicSlug(slug: string): boolean {
  return RESERVED_PUBLIC_SLUG_PATTERNS.some((pattern) => pattern.test(slug.toLowerCase()));
}

export const WorkspacePublicSlugSchema = z
  .string()
  .min(WORKSPACE_PUBLIC_SLUG_MIN_LENGTH)
  .max(WORKSPACE_PUBLIC_SLUG_MAX_LENGTH)
  .regex(WORKSPACE_PUBLIC_SLUG_PATTERN, { message: 'Only lowercase letters, digits and single dashes are allowed' });

export const WorkspaceUpdateSchema = z
  .object({
    name: WorkspaceNameSchema.optional().openapi({ description: 'New workspace name (trimmed, 1–100 characters); omitted keeps the current name.' }),
    image: ImageDataUriSchema.nullish().openapi({ description: 'Workspace logo as a base64 raster image data URI; null removes it, omitted keeps it.' }),
    publicSlug: WorkspacePublicSlugSchema.nullish().openapi({
      description:
        'Public slug for guest menus (`/m/{publicSlug}`), unique across workspaces; null removes it, omitted keeps it. Slugs shaped like ids (cuid `c` + 20 or more letters/digits, or a UUID) are rejected with 400 `PUBLIC_SLUG_RESERVED`, slugs used by another workspace or equal to a workspace id with 409 `PUBLIC_SLUG_TAKEN`.',
    }),
  })
  .openapi('WorkspaceUpdateInput');

export const WorkspaceSettingUpdateSchema = z
  .object({
    setting: WorkspaceSettingKeyEnum,
    value: z.string().max(10_000).nullish().openapi({
      description:
        'New value for the setting; null clears it. `timezone` must be an IANA time zone (default Europe/Berlin), `currency` an ISO 4217 code (default EUR), `contentLocales` a JSON string `{"primary":"de","additional":["en"]}`.',
    }),
  })
  .superRefine((input, ctx) => {
    const error = validateWorkspaceSettingValue(input.setting, input.value);
    if (error) ctx.addIssue({ code: 'custom', path: ['value'], message: error });
  })
  .openapi('WorkspaceSettingUpdateInput');

export type WorkspaceUpdateInput = z.infer<typeof WorkspaceUpdateSchema>;
export type WorkspaceSettingUpdateInput = z.infer<typeof WorkspaceSettingUpdateSchema>;

export const workspaceItemApiDoc = {
  basePath: '/workspaces/{workspaceId}',
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'WORKSPACE_READ',
      tags: [ApiTags.workspaceCore],
      summary: 'Get workspace',
      description: 'Get workspace details including settings and members. Expired demo workspaces are deleted and return 410.',
      params: WorkspaceIdParam,
      response: WorkspaceDtoSchema,
      errorResponses: { 410: 'Demo workspace has expired and has been deleted.' },
    },
    PUT: {
      roles: ['MANAGER'],
      permission: 'WORKSPACE_UPDATE',
      tags: [ApiTags.workspaceCore],
      summary: 'Update workspace',
      description:
        'Update the workspace name, logo and/or the public guest-menu slug (409 when the slug is taken). API keys additionally need `GUEST_MENUS_PUBLISH` to change `publicSlug`.',
      params: WorkspaceIdParam,
      body: WorkspaceUpdateSchema,
      response: WorkspaceDtoSchema,
      errorResponses: {
        403: 'An API key without `GUEST_MENUS_PUBLISH` tried to change the public slug.',
        409: 'The public slug is already used by another workspace.',
      },
    },
    DELETE: {
      roles: ['OWNER'],
      permission: null,
      // Destructive and not covered by any API-key scope: owner session only.
      sessionOnly: true,
      tags: [ApiTags.workspaceCore],
      summary: 'Delete workspace',
      description: 'Permanently delete the workspace and all its data. Owner session only.',
      params: WorkspaceIdParam,
      response: DeletionResult,
    },
  },
} satisfies ResourceApiDoc;

export const workspaceSettingsApiDoc = {
  basePath: '/workspaces/{workspaceId}/settings',
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'WORKSPACE_READ',
      tags: [ApiTags.workspaceSettings],
      summary: 'Get workspace settings',
      description: 'Get all workspace settings as a key→value map.',
      params: WorkspaceIdParam,
      response: WorkspaceSettingsDtoSchema,
    },
    PUT: {
      roles: ['MANAGER'],
      permission: 'WORKSPACE_UPDATE',
      tags: [ApiTags.workspaceSettings],
      summary: 'Update workspace setting',
      description:
        'Upsert a single scalar workspace setting and return the full settings map. The `translations` key is rejected — use GET/PUT /translations instead.',
      params: WorkspaceIdParam,
      body: WorkspaceSettingUpdateSchema,
      response: WorkspaceSettingsDtoSchema,
      errorResponses: { 400: 'Setting key `translations` must be managed via /translations.' },
    },
  },
} satisfies ResourceApiDoc;
