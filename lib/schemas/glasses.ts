/**
 * Zod schemas + ResourceApiDocs for the Glasses resource (v1).
 * Pure module (zod + type-only enums) so scripts/generate-openapi.ts can import
 * it without pulling the Prisma runtime. Responses describe the clean public DTO
 * (see lib/api/dto/glasses.ts), NOT the raw Prisma shape.
 */
import { z } from '@lib/openapi/zod';
import { WorkspaceIdParam, DeletionResult } from '@lib/schemas/common';
import { ApiTags } from '@lib/openapi/tags';
import { ImageDataUriSchema } from '@lib/images/imageSchema';
import type { ResourceApiDoc } from '@lib/openapi/types';

const ID_MAX = 128;
const NAME_MAX = 255;
const TEXT_MAX = 10_000;
const AMOUNT_MAX = 1_000_000;
/** Max ids per export request and items per import request. */
export const GLASS_BULK_MAX = 500;

const IdString = z.string().min(1).max(ID_MAX);

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
    id: IdString.optional().openapi({ description: 'Optional client-supplied CUID.' }),
    name: z.string().min(1).max(NAME_MAX),
    deposit: z.coerce.number().min(0).max(AMOUNT_MAX).openapi({ description: 'Deposit in currency units.' }),
    volume: z.coerce.number().min(0).max(AMOUNT_MAX).nullish().openapi({ description: 'Volume in cl.' }),
    image: ImageDataUriSchema.nullish().openapi({ description: 'Base64-encoded raster image (data URI) to attach.' }),
  })
  .openapi('GlassCreateInput');

export const GlassUpdateSchema = z
  .object({
    name: z.string().min(1).max(NAME_MAX),
    deposit: z.coerce.number().min(0).max(AMOUNT_MAX),
    volume: z.coerce.number().min(0).max(AMOUNT_MAX).nullish(),
    image: ImageDataUriSchema.nullish().openapi({ description: 'Base64 raster image (data URI); omitting it removes the current image.' }),
  })
  .openapi('GlassUpdateInput');

export const GlassListQuerySchema = z.object({
  search: z.string().max(NAME_MAX).optional().openapi({ description: 'Case-insensitive name filter.' }),
});

export const GlassCheckQuerySchema = z.object({
  name: z.string().max(NAME_MAX).openapi({ description: 'Name to check for a similar existing glass (min. 3 chars).' }),
});

export const GlassItemParams = WorkspaceIdParam.extend({ glassId: IdString });

/** Body for cloning a glass — the new name to assign to the copy. */
export const GlassCloneSchema = z
  .object({
    name: z.string().min(1).max(NAME_MAX).openapi({ description: 'Name for the cloned glass.' }),
  })
  .openapi('GlassCloneInput');

export const GlassExportJsonBodySchema = z
  .object({ ids: z.array(IdString).min(1).max(GLASS_BULK_MAX).openapi({ description: 'IDs of the glasses to export.' }) })
  .openapi('GlassExportInput');

/** One item of the portable export format (`GlassExportStructure`); unknown keys are ignored. */
export const GlassExportItemSchema = z.object({
  glass: z.object({
    name: z.string().min(1).max(NAME_MAX),
    notes: z.string().max(TEXT_MAX).nullish(),
    volume: z.number().min(0).max(AMOUNT_MAX).nullish(),
    deposit: z.number().min(0).max(AMOUNT_MAX).nullish(),
  }),
});

export type GlassExportItem = z.infer<typeof GlassExportItemSchema>;

export const GlassImportDecisionSchema = z.object({
  exportName: z.string().max(NAME_MAX).optional(),
  decision: z.enum(['import', 'overwrite', 'rename', 'skip']),
  existingId: IdString.nullish().openapi({ description: 'Glass of this workspace to overwrite (required for `overwrite`).' }),
  newName: z.string().max(NAME_MAX).nullish(),
  data: z.unknown().openapi({ description: 'Export item to import (validated unless the decision is `skip`).' }),
});

export type GlassImportDecision = z.infer<typeof GlassImportDecisionSchema>;

export const GlassImportJsonBodySchema = z
  .object({
    phase: z.enum(['validate', 'prepare-mapping', 'execute']),
    exportData: z
      .union([z.array(z.unknown()).max(GLASS_BULK_MAX), z.record(z.string(), z.unknown())])
      .optional()
      .openapi({ description: 'Glass export structure (single object or array). Required for `validate` and `prepare-mapping`.' }),
    decisions: z.array(GlassImportDecisionSchema).max(GLASS_BULK_MAX).optional().openapi({ description: 'Per-item decisions. Required for `execute`.' }),
  })
  .openapi('GlassImportInput');

export type GlassImportJsonBody = z.infer<typeof GlassImportJsonBodySchema>;

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
  operations: {
    POST: {
      roles: ['USER'],
      permission: 'GLASSES_READ',
      tags: [ApiTags.glassesImportExport],
      summary: 'Export glasses as JSON',
      description:
        'Exports the selected glasses in the portable JSON export format. A single glass yields one export object; multiple glasses yield an array. This payload is the exact input accepted by the import endpoint.',
      params: WorkspaceIdParam,
      body: GlassExportJsonBodySchema,
      response: z.any().openapi({ description: 'Legacy glass export structure (single object or array). Round-trips with the import endpoint.' }),
    },
  },
} satisfies ResourceApiDoc;

export const glassesImportJsonApiDoc = {
  basePath: '/workspaces/{workspaceId}/glasses/import/json',
  operations: {
    POST: {
      roles: ['MANAGER'],
      permission: 'GLASSES_CREATE',
      tags: [ApiTags.glassesImportExport],
      summary: 'Import glasses from JSON',
      description:
        'Imports glasses from the portable JSON export format via a three-phase flow (validate / prepare-mapping / execute). Consumes exactly what the export endpoint produces. `execute` is all-or-nothing: if any item or referenced glass is invalid nothing is written (400 with per-item issues), and all writes run in one transaction.',
      params: WorkspaceIdParam,
      body: GlassImportJsonBodySchema,
      response: z.any().openapi({ description: 'Phase-dependent legacy import result (validation summary, mapping proposal or execution results).' }),
      errorResponses: { 400: 'Invalid request or import items; nothing was imported.' },
    },
  },
} satisfies ResourceApiDoc;

export const glassesImageApiDoc = {
  basePath: '/workspaces/{workspaceId}/glasses/{glassId}/image',
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
