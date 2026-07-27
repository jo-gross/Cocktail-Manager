/**
 * Zod schemas + ResourceApiDocs for workspace join requests (v1). Pure module (zod only).
 * List/accept/reject are member management (`USERS_*`); withdrawing one's OWN request is
 * `sessionOnly` (keyed on the caller's id). The DTO exposes only a slim user ref (the legacy
 * GET leaked the whole `User` row).
 */
import { z } from '@lib/openapi/zod';
import { WorkspaceIdParam, DateTimeString, DeletionResult } from '@lib/schemas/common';
import type { ResourceApiDoc } from '@lib/openapi/types';

export const JoinRequestUserRefSchema = z
  .object({
    id: z.string(),
    name: z.string().nullable(),
    email: z.string().nullable().openapi({ description: 'Requester email — shown to managers to identify the person.' }),
    image: z.string().nullable(),
  })
  .openapi('JoinRequestUser');

export const JoinRequestDtoSchema = z
  .object({
    userId: z.string(),
    date: DateTimeString,
    user: JoinRequestUserRefSchema,
  })
  .openapi('JoinRequest');

export type JoinRequestDto = z.infer<typeof JoinRequestDtoSchema>;

export const AcceptRejectResultSchema = z.object({ ok: z.boolean() }).openapi('JoinRequestActionResult');

export const JoinRequestUserParams = WorkspaceIdParam.extend({ userId: z.string() });

export const joinRequestsCollectionApiDoc = {
  basePath: '/workspaces/{workspaceId}/join-requests',
  legacyPath: true,
  operations: {
    GET: {
      roles: ['MANAGER'],
      permission: 'USERS_READ',
      tags: ['Workspace'],
      summary: 'List join requests',
      params: WorkspaceIdParam,
      response: z.array(JoinRequestDtoSchema),
    },
    DELETE: {
      roles: ['USER'],
      permission: null,
      sessionOnly: true,
      tags: ['Workspace'],
      summary: 'Withdraw own join request',
      description: "Withdraws the calling user's own pending join request. Session-only — API keys are not accepted.",
      params: WorkspaceIdParam,
      response: DeletionResult,
      errorResponses: { 404: 'No pending join request.' },
    },
  },
} satisfies ResourceApiDoc;

export const joinRequestsAcceptApiDoc = {
  basePath: '/workspaces/{workspaceId}/join-requests/{userId}/accept',
  legacyPath: true,
  operations: {
    POST: {
      roles: ['MANAGER'],
      permission: 'USERS_UPDATE',
      tags: ['Workspace'],
      summary: 'Accept join request',
      description: 'Accepts a pending join request: adds the user as a member (role USER) and notifies them.',
      params: JoinRequestUserParams,
      response: AcceptRejectResultSchema,
      errorResponses: { 404: 'No pending join request.' },
    },
  },
} satisfies ResourceApiDoc;

export const joinRequestsRejectApiDoc = {
  basePath: '/workspaces/{workspaceId}/join-requests/{userId}/reject',
  legacyPath: true,
  operations: {
    POST: {
      roles: ['MANAGER'],
      permission: 'USERS_UPDATE',
      tags: ['Workspace'],
      summary: 'Reject join request',
      description: 'Rejects (deletes) a pending join request and notifies the user.',
      params: JoinRequestUserParams,
      response: AcceptRejectResultSchema,
      errorResponses: { 404: 'No pending join request.' },
    },
  },
} satisfies ResourceApiDoc;
