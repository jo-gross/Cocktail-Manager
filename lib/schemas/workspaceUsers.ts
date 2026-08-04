/**
 * Zod schemas + ResourceApiDocs for the Workspace Users resource (v1).
 * Pure module (zod + type-only enums) so scripts/generate-openapi.ts can import
 * it without pulling the Prisma runtime. Responses describe the clean public DTO
 * (see lib/api/dto/workspaceUsers.ts), NOT the raw Prisma shape.
 */
import { z } from '@lib/openapi/zod';
import { WorkspaceIdParam, DeletionResult } from '@lib/schemas/common';
import { ApiTags } from '@lib/openapi/tags';
import type { ResourceApiDoc } from '@lib/openapi/types';

/** Workspace role assigned to a membership. */
export const RoleEnum = z.enum(['OWNER', 'ADMIN', 'MANAGER', 'USER']).openapi('Role');

/** Public workspace-user DTO — a membership: flattens the joined User, drops `workspaceId`. */
export const WorkspaceUserDtoSchema = z
  .object({
    userId: z.string(),
    name: z.string().nullable(),
    email: z.string().nullable(),
    image: z.string().nullable().openapi({ description: "URL to the user's avatar image, or null." }),
    role: RoleEnum,
  })
  .openapi('WorkspaceUser');

export type WorkspaceUserDto = z.infer<typeof WorkspaceUserDtoSchema>;

export const WorkspaceUserUpdateSchema = z
  .object({
    role: RoleEnum.openapi({ description: 'New workspace role for the membership.' }),
  })
  .openapi('WorkspaceUserUpdateInput');

export const WorkspaceUserItemParams = WorkspaceIdParam.extend({ userId: z.string() });

export type WorkspaceUserUpdateInput = z.infer<typeof WorkspaceUserUpdateSchema>;

export const workspaceUsersCollectionApiDoc = {
  basePath: '/workspaces/{workspaceId}/users',
  legacyPath: true,
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'USERS_READ',
      tags: [ApiTags.workspaceUsersCore],
      summary: 'List workspace users',
      description: 'List all users (memberships) of a workspace.',
      params: WorkspaceIdParam,
      response: z.array(WorkspaceUserDtoSchema),
    },
  },
} satisfies ResourceApiDoc;

export const workspaceUsersItemApiDoc = {
  basePath: '/workspaces/{workspaceId}/users/{userId}',
  legacyPath: true,
  operations: {
    PUT: {
      roles: ['ADMIN'],
      permission: 'USERS_UPDATE',
      tags: [ApiTags.workspaceUsersCore],
      summary: 'Update workspace user role',
      params: WorkspaceUserItemParams,
      body: WorkspaceUserUpdateSchema,
      response: WorkspaceUserDtoSchema,
      errorResponses: { 403: 'A user cannot change their own role.', 404: 'Workspace user not found.' },
    },
    DELETE: {
      roles: ['ADMIN'],
      permission: 'USERS_DELETE',
      tags: [ApiTags.workspaceUsersCore],
      summary: 'Remove workspace user',
      params: WorkspaceUserItemParams,
      response: DeletionResult,
      errorResponses: { 403: 'A user cannot remove themselves.', 404: 'Workspace user not found.' },
    },
  },
} satisfies ResourceApiDoc;
