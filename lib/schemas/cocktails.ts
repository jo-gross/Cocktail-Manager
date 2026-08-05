/**
 * Zod schemas + ResourceApiDocs for the Cocktails resource (cocktail recipes, v1).
 * Pure module (zod + type-only enums) so scripts/generate-openapi.ts can import
 * it without pulling the Prisma runtime. Responses describe the clean public DTO
 * (see lib/api/dto/cocktails.ts), NOT the raw Prisma shape.
 *
 * Prisma-ism cleanup: `_count.CocktailRecipeImage` collapses to `hasImage`/
 * `imageUrl`; nested `glass`/`ice`/`garnish`/`ingredient`/`unit` become slim refs
 * (with their own `hasImage` where relevant); the raw `ratings` array collapses to
 * `averageRating`/`ratingCount`; no `workspaceId`/PascalCase relations in the DTO.
 *
 * List vs. detail: the collection (`GET /cocktails`) returns the SLIM
 * `CocktailSummaryDto` (no steps/garnishes/ratings) to keep listings light; the
 * item view returns the FULL `CocktailDto` with nested steps, ingredients,
 * garnishes and rating aggregates.
 */
import { z } from '@lib/openapi/zod';
import { ApiTags } from '@lib/openapi/tags';
import { WorkspaceIdParam, DeletionResult } from '@lib/schemas/common';
import type { ResourceApiDoc } from '@lib/openapi/types';

/** Slim glass reference embedded in a cocktail (Prisma `Glass` → clean shape). */
export const CocktailGlassRefSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    deposit: z.number().openapi({ description: 'Glass deposit in currency units.' }),
    hasImage: z.boolean().openapi({ description: 'Whether the glass has an image.' }),
  })
  .openapi('CocktailGlassRef');

/** Slim ice reference embedded in a cocktail (Prisma `Ice` → `{ id, name }`). */
export const CocktailIceRefSchema = z
  .object({
    id: z.string(),
    name: z.string(),
  })
  .openapi('CocktailIceRef');

/** Slim action reference embedded in a step (Prisma `WorkspaceCocktailRecipeStepAction` → `{ id, name }`). */
export const CocktailActionRefSchema = z
  .object({
    id: z.string(),
    name: z.string(),
  })
  .openapi('CocktailActionRef');

/** Slim unit reference embedded in an ingredient line (Prisma `Unit` → `{ id, name }`). */
export const CocktailUnitRefSchema = z
  .object({
    id: z.string(),
    name: z.string(),
  })
  .openapi('CocktailUnitRef');

/** Slim garnish reference embedded in a cocktail garnish (Prisma `Garnish` → clean shape). */
export const CocktailGarnishRefSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    price: z.number().nullable().openapi({ description: 'Garnish price in currency units (drives material cost).' }),
    description: z.string().nullable(),
    notes: z.string().nullable(),
    hasImage: z.boolean().openapi({ description: 'Whether the garnish has an image.' }),
  })
  .openapi('CocktailGarnishRef');

/** Slim ingredient reference embedded in an ingredient line (Prisma `Ingredient` → clean shape). */
export const CocktailIngredientRefSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    shortName: z.string().nullable(),
    description: z.string().nullable(),
    notes: z.string().nullable(),
    tags: z.array(z.string()),
    hasImage: z.boolean().openapi({ description: 'Whether the ingredient has an image.' }),
  })
  .openapi('CocktailIngredientRef');

/** A single ingredient line within a step (Prisma `CocktailRecipeIngredient` → clean shape). */
export const CocktailStepIngredientDtoSchema = z
  .object({
    id: z.string(),
    amount: z.number().nullable().openapi({ description: 'Amount in the given unit, or null.' }),
    optional: z.boolean(),
    ingredientNumber: z.number().int().openapi({ description: 'Ordering index within the step.' }),
    unit: CocktailUnitRefSchema.nullable(),
    ingredient: CocktailIngredientRefSchema.nullable(),
  })
  .openapi('CocktailStepIngredient');

/** A single preparation step (Prisma `CocktailRecipeStep` → clean shape, camelCase `ingredients`). */
export const CocktailStepDtoSchema = z
  .object({
    id: z.string(),
    stepNumber: z.number().int().openapi({ description: 'Ordering index of the step within the recipe.' }),
    optional: z.boolean(),
    action: CocktailActionRefSchema.nullable(),
    ingredients: z.array(CocktailStepIngredientDtoSchema),
  })
  .openapi('CocktailStep');

/** A single garnish attached to a cocktail (Prisma `CocktailRecipeGarnish` → clean shape). */
export const CocktailGarnishDtoSchema = z
  .object({
    garnishId: z.string(),
    garnishNumber: z.number().int().openapi({ description: 'Ordering index of the garnish within the recipe.' }),
    description: z.string().nullable(),
    optional: z.boolean(),
    isAlternative: z.boolean(),
    garnish: CocktailGarnishRefSchema,
  })
  .openapi('CocktailGarnish');

/** Ultra-slim garnish name ref, used only for the list `?include=garnishes` projection. */
export const CocktailGarnishNameRefSchema = z.object({ id: z.string(), name: z.string() }).openapi('CocktailGarnishNameRef');

/** Ultra-slim ingredient name ref, used only for the list `?include=ingredients` projection. */
export const CocktailIngredientNameRefSchema = z
  .object({ id: z.string(), name: z.string(), shortName: z.string().nullable() })
  .openapi('CocktailIngredientNameRef');

/** Fields shared by the slim list summary and the full detail DTO. */
const CocktailBaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  tags: z.array(z.string()),
  price: z.number().nullable(),
  isArchived: z.boolean().openapi({ description: 'Whether the cocktail is archived.' }),
  hasImage: z.boolean().openapi({ description: 'Whether the cocktail has an image.' }),
  imageUrl: z.string().nullable().openapi({ description: 'URL to fetch the cocktail image bytes, or null when hasImage is false.' }),
  glass: CocktailGlassRefSchema.nullable(),
});

/**
 * Slim cocktail DTO for list views — no nested steps/garnishes/ratings. The `garnishes`/`ingredients`
 * name projections are present ONLY when explicitly requested via `?include=garnishes,ingredients`.
 */
export const CocktailSummaryDtoSchema = CocktailBaseSchema.extend({
  garnishes: z
    .array(CocktailGarnishNameRefSchema)
    .optional()
    .openapi({ description: 'Garnish name refs; present only when requested via ?include=garnishes.' }),
  ingredients: z
    .array(CocktailIngredientNameRefSchema)
    .optional()
    .openapi({ description: 'Distinct ingredient name refs across all steps; present only when requested via ?include=ingredients.' }),
}).openapi('CocktailSummary');

/** Full cocktail DTO — summary base plus nested steps, garnishes and rating aggregates. */
export const CocktailDtoSchema = CocktailBaseSchema.extend({
  notes: z.string().nullable(),
  history: z.string().nullable(),
  ice: CocktailIceRefSchema.nullable(),
  garnishes: z.array(CocktailGarnishDtoSchema),
  steps: z.array(CocktailStepDtoSchema),
  averageRating: z.number().nullable().openapi({ description: 'Mean of all rating values, or null when there are no ratings.' }),
  ratingCount: z.number().int().openapi({ description: 'Number of ratings.' }),
}).openapi('Cocktail');

export type CocktailGlassRef = z.infer<typeof CocktailGlassRefSchema>;
export type CocktailUnitRef = z.infer<typeof CocktailUnitRefSchema>;
export type CocktailIngredientRef = z.infer<typeof CocktailIngredientRefSchema>;
export type CocktailGarnishRef = z.infer<typeof CocktailGarnishRefSchema>;
export type CocktailStepIngredientDto = z.infer<typeof CocktailStepIngredientDtoSchema>;
export type CocktailStepDto = z.infer<typeof CocktailStepDtoSchema>;
export type CocktailGarnishDto = z.infer<typeof CocktailGarnishDtoSchema>;
export type CocktailGarnishNameRef = z.infer<typeof CocktailGarnishNameRefSchema>;
export type CocktailIngredientNameRef = z.infer<typeof CocktailIngredientNameRefSchema>;
export type CocktailSummaryDto = z.infer<typeof CocktailSummaryDtoSchema>;
export type CocktailDto = z.infer<typeof CocktailDtoSchema>;

/** Nested ingredient-line input for create/update (mirrors the legacy `steps[].ingredients[]`). */
export const CocktailStepIngredientInputSchema = z.object({
  id: z.string().optional().openapi({ description: 'Existing ingredient-line id; omit/empty for a new line.' }),
  amount: z.coerce.number().nullish().openapi({ description: 'Amount in the given unit, or null.' }),
  optional: z.boolean().optional().openapi({ description: 'Whether this ingredient is optional (default false).' }),
  ingredientNumber: z.coerce.number().int().openapi({ description: 'Ordering index within the step.' }),
  unitId: z.string().nullish().openapi({ description: 'Unit id, or null.' }),
  ingredientId: z.string().nullish().openapi({ description: 'Ingredient id, or null.' }),
});

/** Nested step input for create/update (mirrors the legacy `steps[]`). */
export const CocktailStepInputSchema = z.object({
  id: z.string().optional().openapi({ description: 'Existing step id; omit/empty for a new step.' }),
  stepNumber: z.coerce.number().int().openapi({ description: 'Ordering index of the step within the recipe.' }),
  optional: z.boolean().optional().openapi({ description: 'Whether this step is optional (default false).' }),
  actionId: z.string().openapi({ description: 'Action id for this step.' }),
  ingredients: z.array(CocktailStepIngredientInputSchema).optional().openapi({ description: 'Ingredient lines within this step.' }),
});

/** Nested garnish input for create/update (mirrors the legacy `garnishes[]`). */
export const CocktailGarnishInputSchema = z.object({
  garnishId: z.string(),
  garnishNumber: z.coerce.number().int().openapi({ description: 'Ordering index of the garnish within the recipe.' }),
  description: z.string().nullish(),
  optional: z.boolean().optional().openapi({ description: 'Whether this garnish is optional (default false).' }),
  isAlternative: z.boolean().optional().openapi({ description: 'Whether this garnish is an alternative (default false).' }),
});

export const CocktailCreateSchema = z
  .object({
    id: z.string().optional().openapi({ description: 'Optional client-supplied CUID.' }),
    name: z.string().min(1),
    description: z.string().nullish(),
    notes: z.string().nullish(),
    history: z.string().nullish(),
    tags: z.array(z.string()).optional(),
    price: z.coerce.number().nullish(),
    iceId: z.string().nullish().openapi({ description: 'Ice id, or null.' }),
    glassId: z.string().nullish().openapi({ description: 'Glass id, or null.' }),
    image: z.string().nullish().openapi({ description: 'Base64-encoded image (data URI) to attach.' }),
    steps: z.array(CocktailStepInputSchema).optional().openapi({ description: 'Preparation steps (with their ingredients).' }),
    garnishes: z.array(CocktailGarnishInputSchema).optional().openapi({ description: 'Garnishes attached to the cocktail.' }),
  })
  .openapi('CocktailCreateInput');

export const CocktailUpdateSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().nullish(),
    notes: z.string().nullish(),
    history: z.string().nullish(),
    tags: z.array(z.string()).optional(),
    price: z.coerce.number().nullish(),
    iceId: z.string().nullish().openapi({ description: 'Ice id, or null.' }),
    glassId: z.string().nullish().openapi({ description: 'Glass id, or null.' }),
    image: z.string().nullish().openapi({ description: 'Base64 image; omitting it removes the current image.' }),
    steps: z.array(CocktailStepInputSchema).optional().openapi({
      description: 'Steps (with ingredients). Differentially applied via ids: lines with ids are updated, without ids created, missing ids deleted.',
    }),
    garnishes: z
      .array(CocktailGarnishInputSchema)
      .optional()
      .openapi({ description: 'Garnishes. Differentially applied via garnishId: present are updated/created, missing are deleted.' }),
  })
  .openapi('CocktailUpdateInput');

export const CocktailListQuerySchema = z.object({
  search: z.string().optional().openapi({ description: 'Case-insensitive filter over name, tags, garnishes and ingredients.' }),
  include: z.string().optional().openapi({ description: 'Comma-separated extra projections to embed in each summary: `garnishes`, `ingredients`.' }),
});

export const CocktailCheckQuerySchema = z.object({
  name: z.string().openapi({ description: 'Name to check for a similar existing cocktail (min. 3 chars).' }),
});

export const CocktailItemParams = WorkspaceIdParam.extend({ cocktailId: z.string() });

/** Clone input — the new name for the cloned cocktail. */
export const CocktailCloneSchema = z
  .object({
    name: z.string().min(1).openapi({ description: 'Name for the cloned cocktail.' }),
  })
  .openapi('CocktailCloneInput');
export type CocktailCloneInput = z.infer<typeof CocktailCloneSchema>;

/** Export request body — the ids of the cocktails to export. */
export const CocktailExportJsonSchema = z
  .object({
    cocktailIds: z.array(z.string()).openapi({ description: 'Ids of the cocktails to export.' }),
  })
  .openapi('CocktailExportJsonInput');
export type CocktailExportJsonInput = z.infer<typeof CocktailExportJsonSchema>;

/** PDF export request body — cocktail ids plus rendering options (mirrors the legacy handler). */
export const CocktailExportPdfSchema = z
  .object({
    cocktailIds: z.array(z.string()).openapi({ description: 'Ids of the cocktails to render.' }),
    exportImage: z.boolean().optional().openapi({ description: 'Include the cocktail image (default true).' }),
    exportDescription: z.boolean().optional().openapi({ description: 'Include the description (default true).' }),
    exportNotes: z.boolean().optional().openapi({ description: 'Include the notes (default true).' }),
    exportHistory: z.boolean().optional().openapi({ description: 'Include the history (default true).' }),
    newPagePerCocktail: z.boolean().optional().openapi({ description: 'Start a new page per cocktail (default true).' }),
    showHeader: z.boolean().optional().openapi({ description: 'Render a page header (default false).' }),
    showFooter: z.boolean().optional().openapi({ description: 'Render a page footer with page numbers (default false).' }),
  })
  .openapi('CocktailExportPdfInput');
export type CocktailExportPdfInput = z.infer<typeof CocktailExportPdfSchema>;

/**
 * Import request body. The `exportData` payload MUST retain the exact raw shape
 * produced by the export endpoints (see types/CocktailExportStructure.ts) so the
 * export → import round-trip stays lossless; hence it is modelled loosely.
 */
export const CocktailImportJsonSchema = z
  .object({
    phase: z.enum(['validate', 'prepare-mapping', 'execute']).openapi({ description: 'Import phase to run.' }),
    exportData: z.any().openapi({ description: 'Raw export dump as produced by POST /cocktails/export/json (round-trip format, kept verbatim).' }),
    mappingDecisions: z.any().optional().openapi({ description: 'User mapping decisions, required for the "execute" phase.' }),
  })
  .passthrough()
  .openapi('CocktailImportJsonInput');
export type CocktailImportJsonInput = z.infer<typeof CocktailImportJsonSchema>;

export type CocktailStepIngredientInput = z.infer<typeof CocktailStepIngredientInputSchema>;
export type CocktailStepInput = z.infer<typeof CocktailStepInputSchema>;
export type CocktailGarnishInput = z.infer<typeof CocktailGarnishInputSchema>;
export type CocktailCreateInput = z.infer<typeof CocktailCreateSchema>;
export type CocktailUpdateInput = z.infer<typeof CocktailUpdateSchema>;
export type CocktailListQuery = z.infer<typeof CocktailListQuerySchema>;

export const cocktailsCollectionApiDoc = {
  basePath: '/workspaces/{workspaceId}/cocktails',
  legacyPath: true,
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'COCKTAILS_READ',
      tags: [ApiTags.cocktailsCore],
      summary: 'List cocktails',
      description:
        'List all cocktails of a workspace, optionally filtered by a free-text search over name, tags, garnishes and ingredients. Returns slim summaries; use GET /cocktails/{cocktailId} for the full recipe.',
      params: WorkspaceIdParam,
      query: CocktailListQuerySchema,
      response: z.array(CocktailSummaryDtoSchema),
    },
    POST: {
      roles: ['MANAGER'],
      permission: 'COCKTAILS_CREATE',
      tags: [ApiTags.cocktailsCore],
      summary: 'Create cocktail',
      params: WorkspaceIdParam,
      body: CocktailCreateSchema,
      response: CocktailDtoSchema,
    },
  },
} satisfies ResourceApiDoc;

export const cocktailsItemApiDoc = {
  basePath: '/workspaces/{workspaceId}/cocktails/{cocktailId}',
  legacyPath: true,
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'COCKTAILS_READ',
      tags: [ApiTags.cocktailsCore],
      summary: 'Get cocktail',
      description: 'Returns the full cocktail including nested steps, ingredients, garnishes and rating aggregates.',
      params: CocktailItemParams,
      response: CocktailDtoSchema,
      errorResponses: { 404: 'Cocktail not found.' },
    },
    PUT: {
      roles: ['MANAGER'],
      permission: 'COCKTAILS_UPDATE',
      tags: [ApiTags.cocktailsCore],
      summary: 'Update cocktail',
      description: 'Updates the cocktail metadata and differentially applies its steps, ingredients and garnishes.',
      params: CocktailItemParams,
      body: CocktailUpdateSchema,
      response: CocktailDtoSchema,
      errorResponses: { 404: 'Cocktail not found.' },
    },
    DELETE: {
      roles: ['ADMIN'],
      permission: 'COCKTAILS_DELETE',
      tags: [ApiTags.cocktailsCore],
      summary: 'Delete cocktail',
      params: CocktailItemParams,
      response: DeletionResult,
    },
  },
} satisfies ResourceApiDoc;

export const cocktailsCheckApiDoc = {
  basePath: '/workspaces/{workspaceId}/cocktails/check',
  legacyPath: true,
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'COCKTAILS_READ',
      tags: [ApiTags.cocktailsCore],
      summary: 'Find similar cocktail',
      description: 'Returns the most similar existing cocktail by name, or null.',
      params: WorkspaceIdParam,
      query: CocktailCheckQuerySchema,
      response: z.union([CocktailSummaryDtoSchema, z.null()]),
    },
  },
} satisfies ResourceApiDoc;

export const cocktailsImageApiDoc = {
  basePath: '/workspaces/{workspaceId}/cocktails/{cocktailId}/image',
  legacyPath: true,
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'COCKTAILS_READ',
      tags: [ApiTags.cocktailsMedia],
      summary: 'Get cocktail image',
      description: 'Returns the cocktail image bytes (the `imageUrl` target). 404 when the cocktail has no image.',
      params: CocktailItemParams,
      rawResponse: { contentTypes: ['image/png', 'image/jpeg', 'image/webp'], description: 'The cocktail image bytes.' },
      errorResponses: { 404: 'The cocktail has no image.' },
    },
  },
} satisfies ResourceApiDoc;

export const cocktailsCloneApiDoc = {
  basePath: '/workspaces/{workspaceId}/cocktails/{cocktailId}/clone',
  legacyPath: true,
  operations: {
    POST: {
      roles: ['MANAGER'],
      permission: 'COCKTAILS_CREATE',
      tags: [ApiTags.cocktailsLifecycle],
      summary: 'Clone cocktail',
      description: 'Creates a deep copy of a cocktail (image, steps, ingredients and garnishes) under a new name.',
      params: CocktailItemParams,
      body: CocktailCloneSchema,
      response: CocktailDtoSchema,
      errorResponses: { 404: 'Cocktail not found.' },
    },
  },
} satisfies ResourceApiDoc;

export const cocktailsArchiveApiDoc = {
  basePath: '/workspaces/{workspaceId}/cocktails/{cocktailId}/archive',
  legacyPath: true,
  operations: {
    PUT: {
      roles: ['MANAGER'],
      permission: 'COCKTAILS_UPDATE',
      tags: [ApiTags.cocktailsLifecycle],
      summary: 'Archive cocktail',
      params: CocktailItemParams,
      response: CocktailDtoSchema,
      errorResponses: { 404: 'Cocktail not found.' },
    },
  },
} satisfies ResourceApiDoc;

export const cocktailsUnarchiveApiDoc = {
  basePath: '/workspaces/{workspaceId}/cocktails/{cocktailId}/unarchive',
  legacyPath: true,
  operations: {
    PUT: {
      roles: ['MANAGER'],
      permission: 'COCKTAILS_UPDATE',
      tags: [ApiTags.cocktailsLifecycle],
      summary: 'Unarchive cocktail',
      params: CocktailItemParams,
      response: CocktailDtoSchema,
      errorResponses: { 404: 'Cocktail not found.' },
    },
  },
} satisfies ResourceApiDoc;

export const cocktailsExportJsonApiDoc = {
  basePath: '/workspaces/{workspaceId}/cocktails/export/json',
  legacyPath: false,
  operations: {
    POST: {
      roles: ['USER'],
      permission: null,
      tags: [ApiTags.cocktailsImportExport],
      summary: 'Export cocktails as JSON',
      description:
        'Returns a self-contained JSON dump (cocktails plus their referenced glasses, garnishes, ingredients, units, ice and step actions, including images) that can be re-imported via POST /cocktails/import/json. The exact dump shape is preserved verbatim for a lossless round-trip.',
      params: WorkspaceIdParam,
      body: CocktailExportJsonSchema,
      response: z.any().openapi({ description: 'Raw export dump (see types/CocktailExportStructure.ts). Returned verbatim, not wrapped in a data envelope.' }),
      errorResponses: { 400: 'No cocktails selected.', 404: 'No cocktails found.' },
    },
  },
} satisfies ResourceApiDoc;

export const cocktailsExportPdfApiDoc = {
  basePath: '/workspaces/{workspaceId}/cocktails/export/pdf',
  legacyPath: false,
  operations: {
    POST: {
      roles: ['USER'],
      permission: 'COCKTAILS_READ',
      tags: [ApiTags.cocktailsImportExport],
      summary: 'Export cocktails as PDF',
      description: 'Renders the selected cocktails to a single PDF document. Requires the Chromium PDF service to be configured.',
      params: WorkspaceIdParam,
      body: CocktailExportPdfSchema,
      rawResponse: { contentTypes: ['application/pdf'], description: 'The generated PDF document.' },
      errorResponses: { 400: 'cocktailIds missing or empty.', 404: 'No cocktails found.', 503: 'PDF export service not configured/available.' },
    },
  },
} satisfies ResourceApiDoc;

export const cocktailsImportJsonApiDoc = {
  basePath: '/workspaces/{workspaceId}/cocktails/import/json',
  legacyPath: false,
  operations: {
    POST: {
      roles: ['USER'],
      permission: null,
      tags: [ApiTags.cocktailsImportExport],
      summary: 'Import cocktails from JSON',
      description:
        'Three-phase import (`validate` → `prepare-mapping` → `execute`) of an export dump produced by POST /cocktails/export/json. The response shape depends on the phase and is returned verbatim (not wrapped in a data envelope).',
      params: WorkspaceIdParam,
      body: CocktailImportJsonSchema,
      response: z
        .any()
        .openapi({ description: 'Phase-dependent import result (validation summary, mapping suggestions, or import counts). Returned verbatim.' }),
      errorResponses: { 400: 'Invalid structure/phase or missing mapping decisions.', 500: 'Import failed.' },
    },
  },
} satisfies ResourceApiDoc;
