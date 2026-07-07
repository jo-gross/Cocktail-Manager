/**
 * Zod schema + ResourceApiDoc for the token-identity endpoint (GET /api/v1/me).
 * Pure module (zod only) so scripts/generate-openapi.ts can import it without
 * the Prisma runtime. Lets a client resolve its workspace + permissions from an
 * API token WITHOUT knowing the workspace ID up front.
 */
import { z } from '@lib/openapi/zod';
import type { ResourceApiDoc } from '@lib/openapi/types';
import { PermissionEnum } from '@lib/schemas/permissions';

/** Slim workspace reference (id + name) the token is scoped to. */
export const WorkspaceRefSchema = z.object({ id: z.string(), name: z.string() }).openapi('WorkspaceRef');

/** Slim API-key reference (id + name) that authenticated the request. */
export const ApiKeyRefSchema = z.object({ id: z.string(), name: z.string() }).openapi('ApiKeyRef');

/** Identity of the authenticated API token: which workspace, what it may do, which key. */
export const MeDtoSchema = z
  .object({
    workspaceId: z.string().nullable().openapi({ description: 'Workspace the token is scoped to, or null for the instance master key.' }),
    workspace: WorkspaceRefSchema.nullable(),
    permissions: z.array(PermissionEnum).openapi({ description: 'Permission scopes granted to this token.' }),
    apiKey: ApiKeyRefSchema,
    isMaster: z.boolean().openapi({ description: 'True when authenticated with the instance master key (full, non-workspace-scoped access).' }),
  })
  .openapi('Me');

export type MeDto = z.infer<typeof MeDtoSchema>;

export const meApiDoc = {
  basePath: '/me',
  // New v1-only endpoint: no unversioned/legacy mirror.
  legacyPath: false,
  operations: {
    GET: {
      roles: ['USER'],
      // Any valid API key (or the instance master key); no specific permission required.
      permission: null,
      tags: ['Workspace'],
      summary: 'Get token identity',
      description:
        'Returns the workspace, granted permissions and key metadata for the authenticated API token. ' +
        'Use this to resolve the workspace ID from a token without knowing it up front.',
      response: MeDtoSchema,
    },
  },
} satisfies ResourceApiDoc;
