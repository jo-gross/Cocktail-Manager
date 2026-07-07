/**
 * Zod schemas + ResourceApiDocs for the Garnishes resource (v1).
 * Pure module (zod + type-only enums) so scripts/generate-openapi.ts can import
 * it without pulling the Prisma runtime. Responses describe the clean public DTO
 * (see lib/api/dto/garnishes.ts), NOT the raw Prisma shape.
 */
import { z } from '@lib/openapi/zod';
import { WorkspaceIdParam, DeletionResult } from '@lib/schemas/common';
import type { ResourceApiDoc } from '@lib/openapi/types';

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
  })
  .openapi('Garnish');

export type GarnishDto = z.infer<typeof GarnishDtoSchema>;

export const GarnishCreateSchema = z
  .object({
    id: z.string().optional().openapi({ description: 'Optional client-supplied CUID.' }),
    name: z.string().min(1),
    price: z.coerce.number().nullish().openapi({ description: 'Price in currency units.' }),
    description: z.string().nullish(),
    notes: z.string().nullish(),
    image: z.string().nullish().openapi({ description: 'Base64-encoded image (data URI) to attach.' }),
  })
  .openapi('GarnishCreateInput');

export const GarnishUpdateSchema = z
  .object({
    name: z.string().min(1),
    price: z.coerce.number().nullish(),
    description: z.string().nullish(),
    notes: z.string().nullish(),
    image: z.string().nullish().openapi({ description: 'Base64 image; omitting it removes the current image.' }),
  })
  .openapi('GarnishUpdateInput');

export const GarnishListQuerySchema = z.object({
  search: z.string().optional().openapi({ description: 'Case-insensitive name filter.' }),
});

export const GarnishCheckQuerySchema = z.object({
  name: z.string().openapi({ description: 'Name to check for a similar existing garnish (min. 3 chars).' }),
});

export const GarnishItemParams = WorkspaceIdParam.extend({ garnishId: z.string() });

/** Body for cloning a garnish — the new name to assign to the copy. */
export const GarnishCloneSchema = z
  .object({
    name: z.string().min(1).openapi({ description: 'Name for the cloned garnish.' }),
  })
  .openapi('GarnishCloneInput');

export type GarnishCreateInput = z.infer<typeof GarnishCreateSchema>;
export type GarnishUpdateInput = z.infer<typeof GarnishUpdateSchema>;
export type GarnishListQuery = z.infer<typeof GarnishListQuerySchema>;

export const garnishesCollectionApiDoc = {
  basePath: '/workspaces/{workspaceId}/garnishes',
  legacyPath: true,
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'GARNISHES_READ',
      tags: ['Garnishes'],
      summary: 'List garnishes',
      description: 'List all garnishes of a workspace, optionally filtered by name.',
      params: WorkspaceIdParam,
      query: GarnishListQuerySchema,
      response: z.array(GarnishDtoSchema),
    },
    POST: {
      roles: ['MANAGER'],
      permission: 'GARNISHES_CREATE',
      tags: ['Garnishes'],
      summary: 'Create garnish',
      params: WorkspaceIdParam,
      body: GarnishCreateSchema,
      response: GarnishDtoSchema,
    },
  },
} satisfies ResourceApiDoc;

export const garnishesItemApiDoc = {
  basePath: '/workspaces/{workspaceId}/garnishes/{garnishId}',
  legacyPath: true,
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'GARNISHES_READ',
      tags: ['Garnishes'],
      summary: 'Get garnish',
      params: GarnishItemParams,
      response: GarnishDtoSchema,
      errorResponses: { 404: 'Garnish not found.' },
    },
    PUT: {
      roles: ['MANAGER'],
      permission: 'GARNISHES_UPDATE',
      tags: ['Garnishes'],
      summary: 'Update garnish',
      params: GarnishItemParams,
      body: GarnishUpdateSchema,
      response: GarnishDtoSchema,
    },
    DELETE: {
      roles: ['ADMIN'],
      permission: 'GARNISHES_DELETE',
      tags: ['Garnishes'],
      summary: 'Delete garnish',
      params: GarnishItemParams,
      response: DeletionResult,
    },
  },
} satisfies ResourceApiDoc;

export const garnishesCheckApiDoc = {
  basePath: '/workspaces/{workspaceId}/garnishes/check',
  legacyPath: true,
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'GARNISHES_READ',
      tags: ['Garnishes'],
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
  legacyPath: true,
  operations: {
    POST: {
      roles: ['MANAGER'],
      permission: 'GARNISHES_CREATE',
      tags: ['Garnishes'],
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
  legacyPath: false,
  operations: {
    POST: {
      roles: ['USER'],
      permission: null,
      tags: ['Garnishes'],
      summary: 'Export garnishes as JSON',
      description:
        'Exports the selected garnishes in the portable JSON export format. A single garnish yields one export object; multiple garnishes yield an array. This payload is the exact input accepted by the import endpoint.',
      params: WorkspaceIdParam,
      body: z.object({ ids: z.array(z.string()).openapi({ description: 'IDs of the garnishes to export.' }) }).openapi('GarnishExportInput'),
      response: z.any().openapi({ description: 'Legacy garnish export structure (single object or array). Round-trips with the import endpoint.' }),
    },
  },
} satisfies ResourceApiDoc;

export const garnishesImportJsonApiDoc = {
  basePath: '/workspaces/{workspaceId}/garnishes/import/json',
  legacyPath: false,
  operations: {
    POST: {
      roles: ['MANAGER'],
      permission: 'GARNISHES_CREATE',
      tags: ['Garnishes'],
      summary: 'Import garnishes from JSON',
      description:
        'Imports garnishes from the portable JSON export format via a three-phase flow (validate / prepare-mapping / execute). Consumes exactly what the export endpoint produces.',
      params: WorkspaceIdParam,
      body: z
        .any()
        .openapi({ description: 'Import request: { phase, exportData, decisions? }. exportData is the garnish export structure (single object or array).' }),
      response: z.any().openapi({ description: 'Phase-dependent legacy import result (validation summary, mapping proposal or execution results).' }),
    },
  },
} satisfies ResourceApiDoc;

export const garnishesImageApiDoc = {
  basePath: '/workspaces/{workspaceId}/garnishes/{garnishId}/image',
  legacyPath: true,
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'GARNISHES_READ',
      tags: ['Garnishes'],
      summary: 'Get garnish image',
      description: 'Returns the garnish image bytes (the `imageUrl` target). 404 when the garnish has no image.',
      params: GarnishItemParams,
      rawResponse: { contentTypes: ['image/png', 'image/jpeg', 'image/webp'], description: 'The garnish image bytes.' },
      errorResponses: { 404: 'The garnish has no image.' },
    },
  },
} satisfies ResourceApiDoc;
