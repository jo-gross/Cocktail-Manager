/**
 * Zod schemas + ResourceApiDocs for workspace join codes (v1). Pure module (zod only).
 * Join codes let people join a workspace; management reuses the `USERS_*` member scopes.
 */
import { z } from '@lib/openapi/zod';
import { WorkspaceIdParam, DateTimeString, DeletionResult } from '@lib/schemas/common';
import { ApiTags } from '@lib/openapi/tags';
import type { ResourceApiDoc } from '@lib/openapi/types';

/** Public join-code DTO — no `workspaceId` (implied by the path). */
export const JoinCodeDtoSchema = z
  .object({
    code: z.string(),
    expires: DateTimeString.nullable(),
    onlyUseOnce: z.boolean(),
    used: z.number().int().openapi({ description: 'How many times the code has been used.' }),
    createdAt: DateTimeString,
  })
  .openapi('JoinCode');

export type JoinCodeDto = z.infer<typeof JoinCodeDtoSchema>;

export const JoinCodeCreateSchema = z
  .object({
    code: z.string().min(1),
    expires: z.string().nullish().openapi({ description: 'ISO expiry timestamp, or null/omitted for no expiry.' }),
    onlyUseOnce: z.boolean().optional().openapi({ description: 'Whether the code can only be used once (default false).' }),
  })
  .openapi('JoinCodeCreateInput');

export type JoinCodeCreateInput = z.infer<typeof JoinCodeCreateSchema>;

export const JoinCodeItemParams = WorkspaceIdParam.extend({ code: z.string() });

export const joinCodesCollectionApiDoc = {
  basePath: '/workspaces/{workspaceId}/join-codes',
  legacyPath: true,
  operations: {
    GET: {
      roles: ['MANAGER'],
      permission: 'USERS_READ',
      tags: [ApiTags.workspaceJoinCodes],
      summary: 'List join codes',
      params: WorkspaceIdParam,
      response: z.array(JoinCodeDtoSchema),
    },
    POST: {
      roles: ['MANAGER'],
      permission: 'USERS_UPDATE',
      tags: [ApiTags.workspaceJoinCodes],
      summary: 'Create join code',
      params: WorkspaceIdParam,
      body: JoinCodeCreateSchema,
      response: JoinCodeDtoSchema,
    },
  },
} satisfies ResourceApiDoc;

export const joinCodesItemApiDoc = {
  basePath: '/workspaces/{workspaceId}/join-codes/{code}',
  legacyPath: true,
  operations: {
    DELETE: {
      roles: ['MANAGER'],
      permission: 'USERS_UPDATE',
      tags: [ApiTags.workspaceJoinCodes],
      summary: 'Delete join code',
      params: JoinCodeItemParams,
      response: DeletionResult,
      errorResponses: { 404: 'Join code not found.' },
    },
  },
} satisfies ResourceApiDoc;
