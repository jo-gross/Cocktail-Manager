/**
 * Zod schemas + ResourceApiDocs for the Ingredients resource (v1).
 * Pure module (zod + type-only enums) so scripts/generate-openapi.ts can import
 * it without pulling the Prisma runtime. Responses describe the clean public DTO
 * (see lib/api/dto/ingredients.ts), NOT the raw Prisma shape.
 */
import { z } from '@lib/openapi/zod';
import { ApiTags } from '@lib/openapi/tags';
import { WorkspaceIdParam, DeletionResult } from '@lib/schemas/common';
import type { ResourceApiDoc } from '@lib/openapi/types';

/** A single unit volume of an ingredient (Prisma `IngredientVolume` → clean shape). */
export const IngredientVolumeDtoSchema = z
  .object({
    id: z.string(),
    volume: z.number().openapi({ description: 'Volume amount in the given unit.' }),
    unit: z
      .object({
        id: z.string(),
        name: z.string(),
      })
      .openapi('IngredientVolumeUnit'),
  })
  .openapi('IngredientVolume');

/** Public ingredient DTO — no Prisma-isms: `hasImage`/`imageUrl` instead of `_count`/base64, camelCase `volumes`. */
export const IngredientDtoSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    shortName: z.string().nullable(),
    description: z.string().nullable(),
    notes: z.string().nullable(),
    price: z.number().nullable(),
    link: z.string().nullable(),
    tags: z.array(z.string()),
    volumes: z.array(IngredientVolumeDtoSchema),
    hasImage: z.boolean().openapi({ description: 'Whether the ingredient has an image.' }),
    imageUrl: z.string().nullable().openapi({ description: 'URL to fetch the ingredient image bytes, or null when hasImage is false.' }),
  })
  .openapi('Ingredient');

export type IngredientDto = z.infer<typeof IngredientDtoSchema>;

/** Nested unit input for create/update (mirrors the legacy `units: [{ unitId, volume }]`). */
export const IngredientVolumeInputSchema = z.object({
  unitId: z.string(),
  volume: z.coerce.number().openapi({ description: 'Volume amount in the given unit.' }),
});

export const IngredientCreateSchema = z
  .object({
    id: z.string().optional().openapi({ description: 'Optional client-supplied CUID.' }),
    name: z.string().min(1),
    shortName: z.string().nullish(),
    description: z.string().nullish(),
    notes: z.string().nullish(),
    price: z.coerce.number().nullish(),
    link: z.string().nullish(),
    tags: z.array(z.string()).optional(),
    units: z.array(IngredientVolumeInputSchema).optional().openapi({ description: 'Unit volumes to attach.' }),
    image: z.string().nullish().openapi({ description: 'Base64-encoded image (data URI) to attach.' }),
  })
  .openapi('IngredientCreateInput');

export const IngredientUpdateSchema = z
  .object({
    name: z.string().min(1),
    shortName: z.string().nullish(),
    description: z.string().nullish(),
    notes: z.string().nullish(),
    price: z.coerce.number().nullish(),
    link: z.string().nullish(),
    tags: z.array(z.string()).optional(),
    units: z.array(IngredientVolumeInputSchema).optional().openapi({ description: 'Unit volumes to attach (replaces existing).' }),
    image: z.string().nullish().openapi({ description: 'Base64 image; omitting it removes the current image.' }),
  })
  .openapi('IngredientUpdateInput');

export const IngredientListQuerySchema = z.object({
  search: z.string().optional().openapi({ description: 'Case-insensitive name/short-name filter.' }),
});

export const IngredientCheckQuerySchema = z.object({
  name: z.string().optional().openapi({ description: 'Name to check for a similar existing ingredient (min. 3 chars).' }),
  link: z.string().optional().openapi({ description: 'Link to check for a similar existing ingredient.' }),
});

export const IngredientItemParams = WorkspaceIdParam.extend({ ingredientId: z.string() });

/** Body for cloning an ingredient — the new name to assign to the copy. */
export const IngredientCloneSchema = z
  .object({
    name: z.string().min(1).openapi({ description: 'Name for the cloned ingredient.' }),
  })
  .openapi('IngredientCloneInput');

/** Slim cocktail reference (id + name) used in the references list. */
export const IngredientReferenceSchema = z
  .object({
    id: z.string(),
    name: z.string(),
  })
  .openapi('IngredientReference');

export type IngredientCreateInput = z.infer<typeof IngredientCreateSchema>;
export type IngredientUpdateInput = z.infer<typeof IngredientUpdateSchema>;
export type IngredientListQuery = z.infer<typeof IngredientListQuerySchema>;

export const ingredientsCollectionApiDoc = {
  basePath: '/workspaces/{workspaceId}/ingredients',
  legacyPath: true,
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'INGREDIENTS_READ',
      tags: [ApiTags.ingredientsCore],
      summary: 'List ingredients',
      description: 'List all ingredients of a workspace, optionally filtered by name or short name.',
      params: WorkspaceIdParam,
      query: IngredientListQuerySchema,
      response: z.array(IngredientDtoSchema),
    },
    POST: {
      roles: ['MANAGER'],
      permission: 'INGREDIENTS_CREATE',
      tags: [ApiTags.ingredientsCore],
      summary: 'Create ingredient',
      params: WorkspaceIdParam,
      body: IngredientCreateSchema,
      response: IngredientDtoSchema,
    },
  },
} satisfies ResourceApiDoc;

export const ingredientsItemApiDoc = {
  basePath: '/workspaces/{workspaceId}/ingredients/{ingredientId}',
  legacyPath: true,
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'INGREDIENTS_READ',
      tags: [ApiTags.ingredientsCore],
      summary: 'Get ingredient',
      params: IngredientItemParams,
      response: IngredientDtoSchema,
      errorResponses: { 404: 'Ingredient not found.' },
    },
    PUT: {
      roles: ['MANAGER'],
      permission: 'INGREDIENTS_UPDATE',
      tags: [ApiTags.ingredientsCore],
      summary: 'Update ingredient',
      params: IngredientItemParams,
      body: IngredientUpdateSchema,
      response: IngredientDtoSchema,
    },
    DELETE: {
      roles: ['ADMIN'],
      permission: 'INGREDIENTS_DELETE',
      tags: [ApiTags.ingredientsCore],
      summary: 'Delete ingredient',
      params: IngredientItemParams,
      response: DeletionResult,
      errorResponses: { 409: 'Ingredient is still referenced by cocktails and cannot be deleted.' },
    },
  },
} satisfies ResourceApiDoc;

export const ingredientsCheckApiDoc = {
  basePath: '/workspaces/{workspaceId}/ingredients/check',
  legacyPath: true,
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'INGREDIENTS_READ',
      tags: [ApiTags.ingredientsCore],
      summary: 'Find similar ingredient',
      description: 'Returns the most similar existing ingredient by name or link, or null.',
      params: WorkspaceIdParam,
      query: IngredientCheckQuerySchema,
      response: z.union([IngredientDtoSchema, z.null()]),
    },
  },
} satisfies ResourceApiDoc;

export const ingredientsCloneApiDoc = {
  basePath: '/workspaces/{workspaceId}/ingredients/{ingredientId}/clone',
  legacyPath: true,
  operations: {
    POST: {
      roles: ['MANAGER'],
      permission: 'INGREDIENTS_CREATE',
      tags: [ApiTags.ingredientsLifecycle],
      summary: 'Clone ingredient',
      description: 'Creates a copy of an ingredient (including its image and unit volumes) under a new name.',
      params: IngredientItemParams,
      body: IngredientCloneSchema,
      response: IngredientDtoSchema,
      errorResponses: { 404: 'Ingredient not found.' },
    },
  },
} satisfies ResourceApiDoc;

export const ingredientsReferencesApiDoc = {
  basePath: '/workspaces/{workspaceId}/ingredients/{ingredientId}/references',
  legacyPath: true,
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'INGREDIENTS_READ',
      tags: [ApiTags.ingredientsReferences],
      summary: 'List ingredient references',
      description: 'Lists the cocktails that reference this ingredient.',
      params: IngredientItemParams,
      response: z.array(IngredientReferenceSchema),
    },
  },
} satisfies ResourceApiDoc;

export const ingredientsExportJsonApiDoc = {
  basePath: '/workspaces/{workspaceId}/ingredients/export/json',
  legacyPath: false,
  operations: {
    POST: {
      roles: ['USER'],
      permission: null,
      tags: [ApiTags.ingredientsImportExport],
      summary: 'Export ingredients as JSON',
      description:
        'Exports the selected ingredients (with their unit volumes and units) in the portable JSON export format. A single ingredient yields one export object; multiple ingredients yield an array. This payload is the exact input accepted by the import endpoint.',
      params: WorkspaceIdParam,
      body: z.object({ ids: z.array(z.string()).openapi({ description: 'IDs of the ingredients to export.' }) }).openapi('IngredientExportInput'),
      response: z.any().openapi({ description: 'Legacy ingredient export structure (single object or array). Round-trips with the import endpoint.' }),
    },
  },
} satisfies ResourceApiDoc;

export const ingredientsImportJsonApiDoc = {
  basePath: '/workspaces/{workspaceId}/ingredients/import/json',
  legacyPath: false,
  operations: {
    POST: {
      roles: ['MANAGER'],
      permission: 'INGREDIENTS_CREATE',
      tags: [ApiTags.ingredientsImportExport],
      summary: 'Import ingredients from JSON',
      description:
        'Imports ingredients from the portable JSON export format via a three-phase flow (validate / prepare-mapping / execute). Consumes exactly what the export endpoint produces; missing units are recreated by name.',
      params: WorkspaceIdParam,
      body: z
        .any()
        .openapi({ description: 'Import request: { phase, exportData, decisions? }. exportData is the ingredient export structure (single object or array).' }),
      response: z.any().openapi({ description: 'Phase-dependent legacy import result (validation summary, mapping proposal or execution results).' }),
    },
  },
} satisfies ResourceApiDoc;

export const ingredientsImageApiDoc = {
  basePath: '/workspaces/{workspaceId}/ingredients/{ingredientId}/image',
  legacyPath: true,
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'INGREDIENTS_READ',
      tags: [ApiTags.ingredientsMedia],
      summary: 'Get ingredient image',
      description: 'Returns the ingredient image bytes (the `imageUrl` target). 404 when the ingredient has no image.',
      params: IngredientItemParams,
      rawResponse: { contentTypes: ['image/png', 'image/jpeg', 'image/webp'], description: 'The ingredient image bytes.' },
      errorResponses: { 404: 'The ingredient has no image.' },
    },
  },
} satisfies ResourceApiDoc;
