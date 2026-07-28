/**
 * Zod schemas + ResourceApiDocs for workspace API-key management (v1). Pure module (zod only).
 * Listing/reading a key is metadata-only (`WORKSPACE_READ`); the secret is shown ONCE on create.
 * Create/revoke are `sessionOnly` — a key must never mint or revoke other keys, and create writes
 * the real `createdByUserId` FK (which the synthetic API-key user cannot satisfy).
 */
import { z } from '@lib/openapi/zod';
import { WorkspaceIdParam, DateTimeString, DeletionResult } from '@lib/schemas/common';
import { PermissionEnum } from '@lib/schemas/permissions';
import { ApiTags } from '@lib/openapi/tags';
import type { ResourceApiDoc } from '@lib/openapi/types';

export const ApiKeyCreatorRefSchema = z.object({ id: z.string(), name: z.string().nullable(), email: z.string().nullable() }).openapi('ApiKeyCreator');

/** Public API-key metadata DTO — never exposes the secret nor the raw keyId. */
export const ApiKeyDtoSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    keyPrefix: z.string().openapi({ description: 'First characters of the internal key id, for identification.' }),
    revoked: z.boolean(),
    expiresAt: DateTimeString.nullable(),
    lastUsedAt: DateTimeString.nullable(),
    createdAt: DateTimeString,
    createdBy: ApiKeyCreatorRefSchema,
    permissions: z.array(PermissionEnum),
  })
  .openapi('ApiKey');

/** One-time create response — includes the signed token. */
export const ApiKeyCreateResultSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    key: z.string().openapi({ description: 'The signed API key (JWT). Returned ONLY once — store it now.' }),
    expiresAt: DateTimeString.nullable(),
    createdAt: DateTimeString,
    permissions: z.array(PermissionEnum),
  })
  .openapi('ApiKeyCreateResult');

export const ApiKeyCreateSchema = z
  .object({
    name: z.string().min(1),
    expiresAt: z.string().nullish().openapi({ description: 'ISO expiry timestamp, or null/omitted for no expiry.' }),
    permissions: z.array(PermissionEnum).optional().openapi({ description: 'Permission scopes to grant the key.' }),
  })
  .openapi('ApiKeyCreateInput');

export type ApiKeyDto = z.infer<typeof ApiKeyDtoSchema>;
export type ApiKeyCreateResult = z.infer<typeof ApiKeyCreateResultSchema>;
export type ApiKeyCreateInput = z.infer<typeof ApiKeyCreateSchema>;

export const ApiKeyItemParams = WorkspaceIdParam.extend({ keyId: z.string() });

export const apiKeysCollectionApiDoc = {
  basePath: '/workspaces/{workspaceId}/api-keys',
  legacyPath: true,
  operations: {
    GET: {
      roles: ['ADMIN'],
      permission: 'WORKSPACE_READ',
      tags: [ApiTags.workspaceApiKeys],
      summary: 'List API keys',
      description: 'Lists the workspace API keys (metadata only — the key value is shown only once, on create).',
      params: WorkspaceIdParam,
      response: z.array(ApiKeyDtoSchema),
    },
    POST: {
      roles: ['ADMIN'],
      permission: null,
      sessionOnly: true,
      tags: [ApiTags.workspaceApiKeys],
      summary: 'Create API key',
      description: 'Creates a workspace API key and returns the signed token ONCE. Session-only — API keys cannot mint other keys.',
      params: WorkspaceIdParam,
      body: ApiKeyCreateSchema,
      response: ApiKeyCreateResultSchema,
    },
  },
} satisfies ResourceApiDoc;

export const apiKeysItemApiDoc = {
  basePath: '/workspaces/{workspaceId}/api-keys/{keyId}',
  legacyPath: true,
  operations: {
    GET: {
      roles: ['ADMIN'],
      permission: 'WORKSPACE_READ',
      tags: [ApiTags.workspaceApiKeys],
      summary: 'Get API key',
      params: ApiKeyItemParams,
      response: ApiKeyDtoSchema,
      errorResponses: { 404: 'API key not found.' },
    },
    DELETE: {
      roles: ['ADMIN'],
      permission: null,
      sessionOnly: true,
      tags: [ApiTags.workspaceApiKeys],
      summary: 'Revoke API key',
      description: 'Revokes (deletes) a workspace API key. Session-only — API keys cannot revoke keys.',
      params: ApiKeyItemParams,
      response: DeletionResult,
      errorResponses: { 404: 'API key not found.' },
    },
  },
} satisfies ResourceApiDoc;
