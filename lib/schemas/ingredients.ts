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
import { ImageDataUriSchema } from '@lib/images/imageSchema';
import { IngredientGuestInfoDtoShape, IngredientGuestInfoInputShape } from '@lib/schemas/guestInfo';

const ID_MAX = 128;
const NAME_MAX = 255;
const TEXT_MAX = 10_000;
const LINK_MAX = 2048;
const AMOUNT_MAX = 1_000_000;
const TAGS_MAX = 100;
const VOLUMES_MAX = 100;
/** Max ids per export request and items per import request. */
export const INGREDIENT_BULK_MAX = 500;

const IdString = z.string().min(1).max(ID_MAX);
const TagList = z.array(z.string().max(NAME_MAX)).max(TAGS_MAX);
/** Guest-info code lists of an import item; unknown codes are dropped by the import sanitizer. */
const ImportCodeList = z.array(z.string().max(64)).max(100).nullish();

function hasUniqueUnitIds(units: Array<{ unitId: string }> | undefined): boolean {
  return !units || new Set(units.map((unit) => unit.unitId)).size === units.length;
}

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
    ...IngredientGuestInfoDtoShape,
  })
  .openapi('Ingredient');

export type IngredientDto = z.infer<typeof IngredientDtoSchema>;

/** Nested unit input for create/update (mirrors the legacy `units: [{ unitId, volume }]`). */
export const IngredientVolumeInputSchema = z.object({
  unitId: IdString.openapi({ description: 'Unit of this workspace.' }),
  volume: z.coerce.number().min(0).max(AMOUNT_MAX).openapi({ description: 'Volume amount in the given unit.' }),
});

const IngredientUnitsInput = z
  .array(IngredientVolumeInputSchema)
  .max(VOLUMES_MAX)
  .refine(hasUniqueUnitIds, { message: 'Each unit may only be used once' })
  .optional();

export const IngredientCreateSchema = z
  .object({
    id: IdString.optional().openapi({ description: 'Optional client-supplied CUID.' }),
    name: z.string().min(1).max(NAME_MAX),
    shortName: z.string().max(NAME_MAX).nullish(),
    description: z.string().max(TEXT_MAX).nullish(),
    notes: z.string().max(TEXT_MAX).nullish(),
    price: z.coerce.number().min(0).max(AMOUNT_MAX).nullish(),
    link: z.string().max(LINK_MAX).nullish(),
    tags: TagList.optional(),
    units: IngredientUnitsInput.openapi({ description: 'Unit volumes to attach (units of this workspace, each at most once).' }),
    image: ImageDataUriSchema.nullish().openapi({ description: 'Base64-encoded raster image (data URI) to attach.' }),
    ...IngredientGuestInfoInputShape,
  })
  .openapi('IngredientCreateInput');

export const IngredientUpdateSchema = z
  .object({
    name: z.string().min(1).max(NAME_MAX),
    shortName: z.string().max(NAME_MAX).nullish(),
    description: z.string().max(TEXT_MAX).nullish(),
    notes: z.string().max(TEXT_MAX).nullish(),
    price: z.coerce.number().min(0).max(AMOUNT_MAX).nullish(),
    link: z.string().max(LINK_MAX).nullish(),
    tags: TagList.optional(),
    units: IngredientUnitsInput.openapi({
      description: 'Unit volumes (units of this workspace, each at most once). Replaces the existing volumes; omitting it keeps them unchanged.',
    }),
    image: ImageDataUriSchema.nullish().openapi({ description: 'Base64 raster image (data URI); omitting it removes the current image.' }),
    ...IngredientGuestInfoInputShape,
  })
  .openapi('IngredientUpdateInput');

export const IngredientListQuerySchema = z.object({
  search: z.string().max(NAME_MAX).optional().openapi({ description: 'Case-insensitive name/short-name filter.' }),
});

export const IngredientCheckQuerySchema = z.object({
  name: z.string().max(NAME_MAX).optional().openapi({ description: 'Name to check for a similar existing ingredient (min. 3 chars).' }),
  link: z.string().max(LINK_MAX).optional().openapi({ description: 'Link to check for a similar existing ingredient.' }),
});

export const IngredientItemParams = WorkspaceIdParam.extend({ ingredientId: IdString });

/** Body for cloning an ingredient — the new name to assign to the copy. */
export const IngredientCloneSchema = z
  .object({
    name: z.string().min(1).max(NAME_MAX).openapi({ description: 'Name for the cloned ingredient.' }),
  })
  .openapi('IngredientCloneInput');

export const IngredientExportJsonBodySchema = z
  .object({ ids: z.array(IdString).min(1).max(INGREDIENT_BULK_MAX).openapi({ description: 'IDs of the ingredients to export.' }) })
  .openapi('IngredientExportInput');

/**
 * One item of the portable export format (`IngredientExportStructure`); unknown keys are ignored.
 * Volumes reference units of the same item by their exported id; units are matched by name on import.
 */
export const IngredientExportItemSchema = z
  .object({
    ingredient: z.object({
      name: z.string().min(1).max(NAME_MAX),
      shortName: z.string().max(NAME_MAX).nullish(),
      description: z.string().max(TEXT_MAX).nullish(),
      notes: z.string().max(TEXT_MAX).nullish(),
      price: z.number().min(0).max(AMOUNT_MAX).nullish(),
      link: z.string().max(LINK_MAX).nullish(),
      tags: TagList.nullish(),
      abv: z.number().min(0).max(100).nullish(),
      allergens: ImportCodeList,
      allergenSources: ImportCodeList,
      additives: ImportCodeList,
      guestInfoComplete: z.boolean().nullish(),
      hideOnGuestMenu: z.boolean().nullish(),
      guestName: z.string().max(NAME_MAX).nullish(),
    }),
    ingredientVolumes: z
      .array(z.object({ volume: z.number().min(0).max(AMOUNT_MAX), unitId: IdString }))
      .max(VOLUMES_MAX)
      .nullish(),
    units: z
      .array(z.object({ id: IdString, name: z.string().min(1).max(NAME_MAX) }))
      .max(VOLUMES_MAX)
      .nullish(),
  })
  .superRefine((item, ctx) => {
    const unitNames = new Map((item.units ?? []).map((unit) => [unit.id, unit.name]));
    const usedNames = new Set<string>();
    (item.ingredientVolumes ?? []).forEach((volume, index) => {
      const name = unitNames.get(volume.unitId);
      if (name === undefined) {
        ctx.addIssue({ code: 'custom', path: ['ingredientVolumes', index, 'unitId'], message: 'Volume references a unit that is not part of the export' });
      } else if (usedNames.has(name)) {
        ctx.addIssue({ code: 'custom', path: ['ingredientVolumes', index, 'unitId'], message: 'Each unit may only be used once' });
      } else {
        usedNames.add(name);
      }
    });
  });

export type IngredientExportItem = z.infer<typeof IngredientExportItemSchema>;

export const IngredientImportDecisionSchema = z.object({
  exportName: z.string().max(NAME_MAX).optional(),
  decision: z.enum(['import', 'overwrite', 'rename', 'skip']),
  existingId: IdString.nullish().openapi({ description: 'Ingredient of this workspace to overwrite (required for `overwrite`).' }),
  newName: z.string().max(NAME_MAX).nullish(),
  data: z.unknown().openapi({ description: 'Export item to import (validated unless the decision is `skip`).' }),
});

export type IngredientImportDecision = z.infer<typeof IngredientImportDecisionSchema>;

export const IngredientImportJsonBodySchema = z
  .object({
    phase: z.enum(['validate', 'prepare-mapping', 'execute']),
    exportData: z
      .union([z.array(z.unknown()).max(INGREDIENT_BULK_MAX), z.record(z.string(), z.unknown())])
      .optional()
      .openapi({ description: 'Ingredient export structure (single object or array). Required for `validate` and `prepare-mapping`.' }),
    decisions: z
      .array(IngredientImportDecisionSchema)
      .max(INGREDIENT_BULK_MAX)
      .optional()
      .openapi({ description: 'Per-item decisions. Required for `execute`.' }),
  })
  .openapi('IngredientImportInput');

export type IngredientImportJsonBody = z.infer<typeof IngredientImportJsonBodySchema>;

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
  operations: {
    POST: {
      roles: ['USER'],
      permission: 'INGREDIENTS_READ',
      tags: [ApiTags.ingredientsImportExport],
      summary: 'Export ingredients as JSON',
      description:
        'Exports the selected ingredients (with their unit volumes and units) in the portable JSON export format. A single ingredient yields one export object; multiple ingredients yield an array. This payload is the exact input accepted by the import endpoint.',
      params: WorkspaceIdParam,
      body: IngredientExportJsonBodySchema,
      response: z.any().openapi({ description: 'Legacy ingredient export structure (single object or array). Round-trips with the import endpoint.' }),
    },
  },
} satisfies ResourceApiDoc;

export const ingredientsImportJsonApiDoc = {
  basePath: '/workspaces/{workspaceId}/ingredients/import/json',
  operations: {
    POST: {
      roles: ['MANAGER'],
      permission: 'INGREDIENTS_CREATE',
      tags: [ApiTags.ingredientsImportExport],
      summary: 'Import ingredients from JSON',
      description:
        'Imports ingredients from the portable JSON export format via a three-phase flow (validate / prepare-mapping / execute). Consumes exactly what the export endpoint produces; missing units are recreated by name. `execute` is all-or-nothing: if any item or referenced ingredient is invalid nothing is written (400 with per-item issues), and all writes run in one transaction.',
      params: WorkspaceIdParam,
      body: IngredientImportJsonBodySchema,
      response: z.any().openapi({ description: 'Phase-dependent legacy import result (validation summary, mapping proposal or execution results).' }),
      errorResponses: { 400: 'Invalid request or import items; nothing was imported.' },
    },
  },
} satisfies ResourceApiDoc;

export const ingredientsImageApiDoc = {
  basePath: '/workspaces/{workspaceId}/ingredients/{ingredientId}/image',
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
