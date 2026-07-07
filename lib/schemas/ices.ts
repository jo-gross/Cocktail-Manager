/**
 * Zod schemas + ResourceApiDocs for the Ice resource (v1).
 * Pure module (zod + type-only enums) so scripts/generate-openapi.ts can import
 * it without pulling the Prisma runtime. Responses describe the clean public DTO
 * (see lib/api/dto/ices.ts), NOT the raw Prisma shape.
 */
import { z } from '@lib/openapi/zod';
import { WorkspaceIdParam } from '@lib/schemas/common';
import type { ResourceApiDoc } from '@lib/openapi/types';

/** Public ice DTO — no Prisma-isms and no `workspaceId` (implied by the path). */
export const IceDtoSchema = z
  .object({
    id: z.string(),
    name: z.string(),
  })
  .openapi('Ice');

export type IceDto = z.infer<typeof IceDtoSchema>;

/** Optional per-language display-name overrides, keyed by language code. */
const TranslationsSchema = z
  .record(z.string(), z.string())
  .openapi({ description: 'Optional display-name translations keyed by language code, e.g. { "en": "Crushed ice" }.' });

export const IceCreateSchema = z
  .object({
    id: z.string().optional().openapi({ description: 'Optional client-supplied CUID.' }),
    name: z.string().min(1),
    translations: TranslationsSchema.optional(),
  })
  .openapi('IceCreateInput');

export const IceUpdateSchema = z
  .object({
    name: z.string().min(1),
    translations: TranslationsSchema.optional(),
  })
  .openapi('IceUpdateInput');

export const IceListQuerySchema = z.object({
  search: z.string().optional().openapi({ description: 'Case-insensitive name filter.' }),
});

export const IceItemParams = WorkspaceIdParam.extend({ iceId: z.string() });

export type IceCreateInput = z.infer<typeof IceCreateSchema>;
export type IceUpdateInput = z.infer<typeof IceUpdateSchema>;
export type IceListQuery = z.infer<typeof IceListQuerySchema>;

export const icesCollectionApiDoc = {
  basePath: '/workspaces/{workspaceId}/ice',
  legacyPath: true,
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'ICE_READ',
      tags: ['Ice'],
      summary: 'List ice',
      description: 'List all ice of a workspace, optionally filtered by name.',
      params: WorkspaceIdParam,
      query: IceListQuerySchema,
      response: z.array(IceDtoSchema),
    },
    POST: {
      roles: ['MANAGER'],
      permission: 'ICE_CREATE',
      tags: ['Ice'],
      summary: 'Create ice',
      params: WorkspaceIdParam,
      body: IceCreateSchema,
      response: IceDtoSchema,
    },
  },
} satisfies ResourceApiDoc;

export const icesItemApiDoc = {
  basePath: '/workspaces/{workspaceId}/ice/{iceId}',
  legacyPath: true,
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'ICE_READ',
      tags: ['Ice'],
      summary: 'Get ice',
      params: IceItemParams,
      response: IceDtoSchema,
      errorResponses: { 404: 'Ice not found.' },
    },
    PUT: {
      roles: ['MANAGER'],
      permission: 'ICE_UPDATE',
      tags: ['Ice'],
      summary: 'Update ice',
      params: IceItemParams,
      body: IceUpdateSchema,
      response: IceDtoSchema,
    },
    DELETE: {
      roles: ['ADMIN'],
      permission: 'ICE_DELETE',
      tags: ['Ice'],
      summary: 'Delete ice',
      params: IceItemParams,
      response: IceDtoSchema,
      errorResponses: { 404: 'Ice not found.' },
    },
  },
} satisfies ResourceApiDoc;
