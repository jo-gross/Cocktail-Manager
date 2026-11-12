/**
 * Zod schemas + ResourceApiDocs for the Garnishes resource (v1).
 * Pure module (zod + type-only enums) so scripts/generate-openapi.ts can import
 * it without pulling the Prisma runtime. Responses describe the clean public DTO
 * (see lib/api/dto/garnishes.ts), NOT the raw Prisma shape.
 */
import { z } from '@lib/openapi/zod';
import { WorkspaceIdParam, DeletionResult } from '@lib/schemas/common';
import { ApiTags } from '@lib/openapi/tags';
import type { ResourceApiDoc } from '@lib/openapi/types';
import { ImageDataUriSchema } from '@lib/images/imageSchema';
import { GarnishGuestInfoDtoShape, GarnishGuestInfoInputShape } from '@lib/schemas/guestInfo';

const ID_MAX = 128;
const NAME_MAX = 255;
const TEXT_MAX = 10_000;
const AMOUNT_MAX = 1_000_000;
/** Max ids per export request and items per import request. */
export const GARNISH_BULK_MAX = 500;

const IdString = z.string().min(1).max(ID_MAX);
/** Guest-info code lists of an import item; unknown codes are dropped by the import sanitizer. */
const ImportCodeList = z.array(z.string().max(64)).max(100).nullish();

/** Public garnish DTO — no Prisma-isms: `hasImage`/`imageUrl` instead of `_count`/base64. */
export const GarnishDtoSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    notes: z.string().nullable(),
    price: z.number().nullable().openapi({ description: 'Price in currency units.' }),
    hasImage: z.boolean().openapi({ description: 'Whether the garnish has an image.' }),
    imageUrl: z.string().nullable().openapi({ description: 'URL to fetch the garnish image bytes, or null when hasImage is false.' }),
    ...GarnishGuestInfoDtoShape,
  })
  .openapi('Garnish');

export type GarnishDto = z.infer<typeof GarnishDtoSchema>;

export const GarnishCreateSchema = z
  .object({
    id: IdString.optional().openapi({ description: 'Optional client-supplied CUID.' }),
    name: z.string().min(1).max(NAME_MAX),
    price: z.coerce.number().min(0).max(AMOUNT_MAX).nullish().openapi({ description: 'Price in currency units.' }),
    description: z.string().max(TEXT_MAX).nullish(),
    notes: z.string().max(TEXT_MAX).nullish(),
    image: ImageDataUriSchema.nullish().openapi({ description: 'Base64-encoded raster image (data URI) to attach.' }),
    ...GarnishGuestInfoInputShape,
  })
  .openapi('GarnishCreateInput');

export const GarnishUpdateSchema = z
  .object({
    name: z.string().min(1).max(NAME_MAX),
    price: z.coerce.number().min(0).max(AMOUNT_MAX).nullish(),
    description: z.string().max(TEXT_MAX).nullish(),
    notes: z.string().max(TEXT_MAX).nullish(),
    image: ImageDataUriSchema.nullish().openapi({ description: 'Base64 raster image (data URI); omitting it removes the current image.' }),
    ...GarnishGuestInfoInputShape,
  })
  .openapi('GarnishUpdateInput');

export const GarnishListQuerySchema = z.object({
  search: z.string().max(NAME_MAX).optional().openapi({ description: 'Case-insensitive name filter.' }),
});

export const GarnishCheckQuerySchema = z.object({
  name: z.string().max(NAME_MAX).openapi({ description: 'Name to check for a similar existing garnish (min. 3 chars).' }),
});

export const GarnishItemParams = WorkspaceIdParam.extend({ garnishId: IdString });

/** Body for cloning a garnish — the new name to assign to the copy. */
export const GarnishCloneSchema = z
  .object({
    name: z.string().min(1).max(NAME_MAX).openapi({ description: 'Name for the cloned garnish.' }),
  })
  .openapi('GarnishCloneInput');

export const GarnishExportJsonBodySchema = z
  .object({ ids: z.array(IdString).min(1).max(GARNISH_BULK_MAX).openapi({ description: 'IDs of the garnishes to export.' }) })
  .openapi('GarnishExportInput');

/** One item of the portable export format (`GarnishExportStructure`); unknown keys are ignored. */
export const GarnishExportItemSchema = z.object({
  garnish: z.object({
    name: z.string().min(1).max(NAME_MAX),
    description: z.string().max(TEXT_MAX).nullish(),
    notes: z.string().max(TEXT_MAX).nullish(),
    price: z.number().min(0).max(AMOUNT_MAX).nullish(),
    allergens: ImportCodeList,
    allergenSources: ImportCodeList,
    additives: ImportCodeList,
    guestInfoComplete: z.boolean().nullish(),
  }),
});

export type GarnishExportItem = z.infer<typeof GarnishExportItemSchema>;

export const GarnishImportDecisionSchema = z.object({
  exportName: z.string().max(NAME_MAX).optional(),
  decision: z.enum(['import', 'overwrite', 'rename', 'skip']),
  existingId: IdString.nullish().openapi({ description: 'Garnish of this workspace to overwrite (required for `overwrite`).' }),
  newName: z.string().max(NAME_MAX).nullish(),
  data: z.unknown().openapi({ description: 'Export item to import (validated unless the decision is `skip`).' }),
});

export type GarnishImportDecision = z.infer<typeof GarnishImportDecisionSchema>;

export const GarnishImportJsonBodySchema = z
  .object({
    phase: z.enum(['validate', 'prepare-mapping', 'execute']),
    exportData: z
      .union([z.array(z.unknown()).max(GARNISH_BULK_MAX), z.record(z.string(), z.unknown())])
      .optional()
      .openapi({ description: 'Garnish export structure (single object or array). Required for `validate` and `prepare-mapping`.' }),
    decisions: z.array(GarnishImportDecisionSchema).max(GARNISH_BULK_MAX).optional().openapi({ description: 'Per-item decisions. Required for `execute`.' }),
  })
  .openapi('GarnishImportInput');

export type GarnishImportJsonBody = z.infer<typeof GarnishImportJsonBodySchema>;

export type GarnishCreateInput = z.infer<typeof GarnishCreateSchema>;
export type GarnishUpdateInput = z.infer<typeof GarnishUpdateSchema>;
export type GarnishListQuery = z.infer<typeof GarnishListQuerySchema>;

export const garnishesCollectionApiDoc = {
  basePath: '/workspaces/{workspaceId}/garnishes',
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'GARNISHES_READ',
      tags: [ApiTags.garnishesCore],
      summary: 'List garnishes',
      description: 'List all garnishes of a workspace, optionally filtered by name.',
      params: WorkspaceIdParam,
      query: GarnishListQuerySchema,
      response: z.array(GarnishDtoSchema),
    },
    POST: {
      roles: ['MANAGER'],
      permission: 'GARNISHES_CREATE',
      tags: [ApiTags.garnishesCore],
      summary: 'Create garnish',
      params: WorkspaceIdParam,
      body: GarnishCreateSchema,
      response: GarnishDtoSchema,
    },
  },
} satisfies ResourceApiDoc;

export const garnishesItemApiDoc = {
  basePath: '/workspaces/{workspaceId}/garnishes/{garnishId}',
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'GARNISHES_READ',
      tags: [ApiTags.garnishesCore],
      summary: 'Get garnish',
      params: GarnishItemParams,
      response: GarnishDtoSchema,
      errorResponses: { 404: 'Garnish not found.' },
    },
    PUT: {
      roles: ['MANAGER'],
      permission: 'GARNISHES_UPDATE',
      tags: [ApiTags.garnishesCore],
      summary: 'Update garnish',
      params: GarnishItemParams,
      body: GarnishUpdateSchema,
      response: GarnishDtoSchema,
    },
    DELETE: {
      roles: ['ADMIN'],
      permission: 'GARNISHES_DELETE',
      tags: [ApiTags.garnishesCore],
      summary: 'Delete garnish',
      params: GarnishItemParams,
      response: DeletionResult,
    },
  },
} satisfies ResourceApiDoc;

export const garnishesCheckApiDoc = {
  basePath: '/workspaces/{workspaceId}/garnishes/check',
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'GARNISHES_READ',
      tags: [ApiTags.garnishesCore],
      summary: 'Find similar garnish',
      description: 'Returns the most similar existing garnish by name, or null.',
      params: WorkspaceIdParam,
      query: GarnishCheckQuerySchema,
      response: z.union([GarnishDtoSchema, z.null()]),
    },
  },
} satisfies ResourceApiDoc;

export const garnishesCloneApiDoc = {
  basePath: '/workspaces/{workspaceId}/garnishes/{garnishId}/clone',
  operations: {
    POST: {
      roles: ['MANAGER'],
      permission: 'GARNISHES_CREATE',
      tags: [ApiTags.garnishesLifecycle],
      summary: 'Clone garnish',
      description: 'Creates a copy of a garnish (including its image) under a new name.',
      params: GarnishItemParams,
      body: GarnishCloneSchema,
      response: GarnishDtoSchema,
      errorResponses: { 404: 'Garnish not found.' },
    },
  },
} satisfies ResourceApiDoc;

export const garnishesExportJsonApiDoc = {
  basePath: '/workspaces/{workspaceId}/garnishes/export/json',
  operations: {
    POST: {
      roles: ['USER'],
      permission: 'GARNISHES_READ',
      tags: [ApiTags.garnishesImportExport],
      summary: 'Export garnishes as JSON',
      description:
        'Exports the selected garnishes in the portable JSON export format. A single garnish yields one export object; multiple garnishes yield an array. This payload is the exact input accepted by the import endpoint.',
      params: WorkspaceIdParam,
      body: GarnishExportJsonBodySchema,
      response: z.any().openapi({ description: 'Legacy garnish export structure (single object or array). Round-trips with the import endpoint.' }),
    },
  },
} satisfies ResourceApiDoc;

export const garnishesImportJsonApiDoc = {
  basePath: '/workspaces/{workspaceId}/garnishes/import/json',
  operations: {
    POST: {
      roles: ['MANAGER'],
      permission: 'GARNISHES_CREATE',
      tags: [ApiTags.garnishesImportExport],
      summary: 'Import garnishes from JSON',
      description:
        'Imports garnishes from the portable JSON export format via a three-phase flow (validate / prepare-mapping / execute). Consumes exactly what the export endpoint produces. `execute` is all-or-nothing: if any item or referenced garnish is invalid nothing is written (400 with per-item issues), and all writes run in one transaction.',
      params: WorkspaceIdParam,
      body: GarnishImportJsonBodySchema,
      response: z.any().openapi({ description: 'Phase-dependent legacy import result (validation summary, mapping proposal or execution results).' }),
      errorResponses: { 400: 'Invalid request or import items; nothing was imported.' },
    },
  },
} satisfies ResourceApiDoc;

export const garnishesImageApiDoc = {
  basePath: '/workspaces/{workspaceId}/garnishes/{garnishId}/image',
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'GARNISHES_READ',
      tags: [ApiTags.garnishesMedia],
      summary: 'Get garnish image',
      description: 'Returns the garnish image bytes (the `imageUrl` target). 404 when the garnish has no image.',
      params: GarnishItemParams,
      rawResponse: { contentTypes: ['image/png', 'image/jpeg', 'image/webp'], description: 'The garnish image bytes.' },
      errorResponses: { 404: 'The garnish has no image.' },
    },
  },
} satisfies ResourceApiDoc;
