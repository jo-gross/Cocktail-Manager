/**
 * Zod schemas + ResourceApiDocs for the Glasses resource (v1).
 * Pure module (zod + type-only enums) so scripts/generate-openapi.ts can import
 * it without pulling the Prisma runtime. Responses describe the clean public DTO
 * (see lib/api/dto/glasses.ts), NOT the raw Prisma shape.
 */
import { z } from '@lib/openapi/zod';
import { WorkspaceIdParam, DeletionResult } from '@lib/schemas/common';
import { ApiTags } from '@lib/openapi/tags';
import type { ResourceApiDoc } from '@lib/openapi/types';

/** Public glass DTO — no Prisma-isms: `hasImage`/`imageUrl` instead of `_count`/base64. */
export const GlassDtoSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    notes: z.string().nullable(),
    volume: z.number().nullable().openapi({ description: 'Volume in cl.' }),
    deposit: z.number().openapi({ description: 'Deposit in currency units.' }),
    hasImage: z.boolean().openapi({ description: 'Whether the glass has an image.' }),
    imageUrl: z.string().nullable().openapi({ description: 'URL to fetch the glass image bytes, or null when hasImage is false.' }),
  })
  .openapi('Glass');

export type GlassDto = z.infer<typeof GlassDtoSchema>;

export const GlassCreateSchema = z
  .object({
    id: z.string().optional().openapi({ description: 'Optional client-supplied CUID.' }),
    name: z.string().min(1),
    deposit: z.coerce.number().openapi({ description: 'Deposit in currency units.' }),
    volume: z.coerce.number().nullish().openapi({ description: 'Volume in cl.' }),
    image: z.string().nullish().openapi({ description: 'Base64-encoded image (data URI) to attach.' }),
  })
  .openapi('GlassCreateInput');

export const GlassUpdateSchema = z
  .object({
    name: z.string().min(1),
    deposit: z.coerce.number(),
    volume: z.coerce.number().nullish(),
    image: z.string().nullish().openapi({ description: 'Base64 image; omitting it removes the current image.' }),
  })
  .openapi('GlassUpdateInput');

export const GlassListQuerySchema = z.object({
  search: z.string().optional().openapi({ description: 'Case-insensitive name filter.' }),
});

export const GlassCheckQuerySchema = z.object({
  name: z.string().openapi({ description: 'Name to check for a similar existing glass (min. 3 chars).' }),
});

export const GlassItemParams = WorkspaceIdParam.extend({ glassId: z.string() });

/** Body for cloning a glass — the new name to assign to the copy. */
export const GlassCloneSchema = z
  .object({
    name: z.string().min(1).openapi({ description: 'Name for the cloned glass.' }),
  })
  .openapi('GlassCloneInput');

/** Slim cocktail reference (id + name) used in the references list. */
export const GlassReferenceSchema = z
  .object({
    id: z.string(),
    name: z.string(),
  })
  .openapi('GlassReference');

export type GlassCreateInput = z.infer<typeof GlassCreateSchema>;
export type GlassUpdateInput = z.infer<typeof GlassUpdateSchema>;
export type GlassListQuery = z.infer<typeof GlassListQuerySchema>;

export const glassesCollectionApiDoc = {
  basePath: '/workspaces/{workspaceId}/glasses',
  legacyPath: true,
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'GLASSES_READ',
      tags: [ApiTags.glassesCore],
      summary: 'List glasses',
      description: 'List all glasses of a workspace, optionally filtered by name.',
      params: WorkspaceIdParam,
      query: GlassListQuerySchema,
      response: z.array(GlassDtoSchema),
    },
    POST: {
      roles: ['MANAGER'],
      permission: 'GLASSES_CREATE',
      tags: [ApiTags.glassesCore],
      summary: 'Create glass',
      params: WorkspaceIdParam,
      body: GlassCreateSchema,
      response: GlassDtoSchema,
    },
  },
} satisfies ResourceApiDoc;

export const glassesItemApiDoc = {
  basePath: '/workspaces/{workspaceId}/glasses/{glassId}',
  legacyPath: true,
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'GLASSES_READ',
      tags: [ApiTags.glassesCore],
      summary: 'Get glass',
      params: GlassItemParams,
      response: GlassDtoSchema,
      errorResponses: { 404: 'Glass not found.' },
    },
    PUT: {
      roles: ['MANAGER'],
      permission: 'GLASSES_UPDATE',
      tags: [ApiTags.glassesCore],
      summary: 'Update glass',
      params: GlassItemParams,
      body: GlassUpdateSchema,
      response: GlassDtoSchema,
    },
    DELETE: {
      roles: ['ADMIN'],
      permission: 'GLASSES_DELETE',
      tags: [ApiTags.glassesCore],
      summary: 'Delete glass',
      params: GlassItemParams,
      response: DeletionResult,
      errorResponses: { 409: 'Glass is still referenced by cocktails and cannot be deleted.' },
    },
  },
} satisfies ResourceApiDoc;

export const glassesCheckApiDoc = {
  basePath: '/workspaces/{workspaceId}/glasses/check',
  legacyPath: true,
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'GLASSES_READ',
      tags: [ApiTags.glassesCore],
      summary: 'Find similar glass',
      description: 'Returns the most similar existing glass by name, or null.',
      params: WorkspaceIdParam,
      query: GlassCheckQuerySchema,
      response: z.union([GlassDtoSchema, z.null()]),
    },
  },
} satisfies ResourceApiDoc;

export const glassesCloneApiDoc = {
  basePath: '/workspaces/{workspaceId}/glasses/{glassId}/clone',
  legacyPath: true,
  operations: {
    POST: {
      roles: ['MANAGER'],
      permission: 'GLASSES_CREATE',
      tags: [ApiTags.glassesLifecycle],
      summary: 'Clone glass',
      description: 'Creates a copy of a glass (including its image) under a new name.',
      params: GlassItemParams,
      body: GlassCloneSchema,
      response: GlassDtoSchema,
      errorResponses: { 404: 'Glass not found.' },
    },
  },
} satisfies ResourceApiDoc;

export const glassesReferencesApiDoc = {
  basePath: '/workspaces/{workspaceId}/glasses/{glassId}/references',
  legacyPath: true,
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'GLASSES_READ',
      tags: [ApiTags.glassesReferences],
      summary: 'List glass references',
      description: 'Lists the cocktails that reference this glass.',
      params: GlassItemParams,
      response: z.array(GlassReferenceSchema),
    },
  },
} satisfies ResourceApiDoc;

export const glassesExportJsonApiDoc = {
  basePath: '/workspaces/{workspaceId}/glasses/export/json',
  legacyPath: false,
  operations: {
    POST: {
      roles: ['USER'],
      permission: null,
      tags: [ApiTags.glassesImportExport],
      summary: 'Export glasses as JSON',
      description:
        'Exports the selected glasses in the portable JSON export format. A single glass yields one export object; multiple glasses yield an array. This payload is the exact input accepted by the import endpoint.',
      params: WorkspaceIdParam,
      body: z.object({ ids: z.array(z.string()).openapi({ description: 'IDs of the glasses to export.' }) }).openapi('GlassExportInput'),
      response: z.any().openapi({ description: 'Legacy glass export structure (single object or array). Round-trips with the import endpoint.' }),
    },
  },
} satisfies ResourceApiDoc;

export const glassesImportJsonApiDoc = {
  basePath: '/workspaces/{workspaceId}/glasses/import/json',
  legacyPath: false,
  operations: {
    POST: {
      roles: ['MANAGER'],
      permission: 'GLASSES_CREATE',
      tags: [ApiTags.glassesImportExport],
      summary: 'Import glasses from JSON',
      description:
        'Imports glasses from the portable JSON export format via a three-phase flow (validate / prepare-mapping / execute). Consumes exactly what the export endpoint produces.',
      params: WorkspaceIdParam,
      body: z
        .any()
        .openapi({ description: 'Import request: { phase, exportData, decisions? }. exportData is the glass export structure (single object or array).' }),
      response: z.any().openapi({ description: 'Phase-dependent legacy import result (validation summary, mapping proposal or execution results).' }),
    },
  },
} satisfies ResourceApiDoc;

export const glassesImageApiDoc = {
  basePath: '/workspaces/{workspaceId}/glasses/{glassId}/image',
  legacyPath: true,
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'GLASSES_READ',
      tags: [ApiTags.glassesMedia],
      summary: 'Get glass image',
      description: 'Returns the glass image bytes (the `imageUrl` target). 404 when the glass has no image.',
      params: GlassItemParams,
      rawResponse: { contentTypes: ['image/png', 'image/jpeg', 'image/webp'], description: 'The glass image bytes.' },
      errorResponses: { 404: 'The glass has no image.' },
    },
  },
} satisfies ResourceApiDoc;
