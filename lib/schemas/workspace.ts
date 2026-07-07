/**
 * Zod schemas + ResourceApiDocs for the Workspace resource (v1).
 * Pure module (zod + type-only enums) so scripts/generate-openapi.ts can import
 * it without pulling the Prisma runtime. Responses describe the clean public DTO
 * (see lib/api/dto/workspace.ts), NOT the raw Prisma shape.
 */
import { z } from '@lib/openapi/zod';
import { WorkspaceIdParam, DateTimeString, DeletionResult } from '@lib/schemas/common';
import type { ResourceApiDoc } from '@lib/openapi/types';

const RoleEnum = z.enum(['OWNER', 'ADMIN', 'MANAGER', 'USER']).openapi('WorkspaceRole');

/** Known workspace setting keys (mirrors Prisma WorkspaceSettingKey). */
const WorkspaceSettingKeyEnum = z.enum(['translations', 'usePrices', 'statisticDayStartTime']).openapi('WorkspaceSettingKey');

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
    settings: WorkspaceSettingsDtoSchema,
    members: z.array(WorkspaceMemberDtoSchema),
  })
  .openapi('Workspace');

export type WorkspaceMemberDto = z.infer<typeof WorkspaceMemberDtoSchema>;
export type WorkspaceSettingsDto = z.infer<typeof WorkspaceSettingsDtoSchema>;
export type WorkspaceDto = z.infer<typeof WorkspaceDtoSchema>;

export const WorkspaceUpdateSchema = z
  .object({
    name: z.string().min(1),
  })
  .openapi('WorkspaceUpdateInput');

export const WorkspaceSettingUpdateSchema = z
  .object({
    setting: WorkspaceSettingKeyEnum,
    value: z.string().nullish().openapi({ description: 'New value for the setting; null clears it.' }),
  })
  .openapi('WorkspaceSettingUpdateInput');

export type WorkspaceUpdateInput = z.infer<typeof WorkspaceUpdateSchema>;
export type WorkspaceSettingUpdateInput = z.infer<typeof WorkspaceSettingUpdateSchema>;

export const workspaceItemApiDoc = {
  basePath: '/workspaces/{workspaceId}',
  legacyPath: true,
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'WORKSPACE_READ',
      tags: ['Workspace'],
      summary: 'Get workspace',
      description: 'Get workspace details including settings and members. Expired demo workspaces are deleted and return 410.',
      params: WorkspaceIdParam,
      response: WorkspaceDtoSchema,
      errorResponses: { 410: 'Demo workspace has expired and has been deleted.' },
    },
    PUT: {
      roles: ['MANAGER'],
      permission: 'WORKSPACE_UPDATE',
      tags: ['Workspace'],
      summary: 'Update workspace',
      description: 'Update the workspace name.',
      params: WorkspaceIdParam,
      body: WorkspaceUpdateSchema,
      response: WorkspaceDtoSchema,
    },
    DELETE: {
      roles: ['ADMIN'],
      permission: null,
      tags: ['Workspace'],
      summary: 'Delete workspace',
      description: 'Permanently delete the workspace and all its data.',
      params: WorkspaceIdParam,
      response: DeletionResult,
    },
  },
} satisfies ResourceApiDoc;

export const workspaceSettingsApiDoc = {
  basePath: '/workspaces/{workspaceId}/settings',
  legacyPath: true,
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'WORKSPACE_READ',
      tags: ['Workspace'],
      summary: 'Get workspace settings',
      description: 'Get all workspace settings as a key→value map.',
      params: WorkspaceIdParam,
      response: WorkspaceSettingsDtoSchema,
    },
    PUT: {
      roles: ['MANAGER'],
      permission: 'WORKSPACE_UPDATE',
      tags: ['Workspace'],
      summary: 'Update workspace setting',
      description: 'Upsert a single workspace setting and return the full settings map.',
      params: WorkspaceIdParam,
      body: WorkspaceSettingUpdateSchema,
      response: WorkspaceSettingsDtoSchema,
    },
  },
} satisfies ResourceApiDoc;
