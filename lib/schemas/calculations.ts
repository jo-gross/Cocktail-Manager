/**
 * Zod schemas + ResourceApiDocs for the Calculations resource (cocktail
 * calculations + groups, v1). Pure module (zod + type-only enums) so
 * scripts/generate-openapi.ts can import it without pulling the Prisma runtime.
 * Responses describe the clean public DTO (see lib/api/dto/calculations.ts),
 * NOT the raw Prisma shape.
 *
 * Prisma-ism cleanup: PascalCase relations become camelCase; nested cocktail
 * relations collapse to a slim `cocktail: { id, name }` ref; the group's
 * `_count.calculations` becomes a plain `calculationCount`; no `workspaceId`
 * (implied by the path).
 *
 * List vs. detail: the collection (`GET /calculations`) returns the SLIM
 * `CalculationSummaryDto` (group ref + slim items) to keep listings light; the
 * item view (`GET /calculations/{calculationId}`) returns the FULL
 * `CalculationDto` with fully-hydrated cocktail items (steps, garnishes,
 * ratings) and ingredient shopping units.
 */
import { z } from '@lib/openapi/zod';
import { WorkspaceIdParam, DateTimeString, DeletionResult } from '@lib/schemas/common';
import type { ResourceApiDoc } from '@lib/openapi/types';

/** Slim cocktail reference embedded in a calculation item (`CocktailRecipe` → `{ id, name }`). */
export const CalculationCocktailRefSchema = z
  .object({
    id: z.string(),
    name: z.string(),
  })
  .openapi('CalculationCocktailRef');

/** Slim group reference embedded in a calculation (`CocktailCalculationGroup` → clean shape, no calculations relation). */
export const CalculationGroupRefSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    isDefaultExpanded: z.boolean(),
  })
  .openapi('CalculationGroupRef');

/** A single calculation item (`CocktailCalculationItems` → clean shape). Has no own id (composite PK). */
export const CalculationItemDtoSchema = z
  .object({
    cocktail: CalculationCocktailRefSchema,
    plannedAmount: z.number().int().openapi({ description: 'Planned number of cocktails for this item.' }),
    customPrice: z.number().nullable().openapi({ description: 'Overridden price for this item, or null.' }),
  })
  .openapi('CalculationItem');

/** Slim ingredient reference embedded in a shopping unit (`Ingredient` → `{ id, name }`). */
export const CalculationIngredientRefSchema = z
  .object({
    id: z.string(),
    name: z.string(),
  })
  .openapi('CalculationIngredientRef');

/** Slim unit reference embedded in a shopping unit (`Unit` → `{ id, name }`). */
export const CalculationUnitRefSchema = z
  .object({
    id: z.string(),
    name: z.string(),
  })
  .openapi('CalculationUnitRef');

/** A single ingredient shopping unit (`CalculationIngredientShoppingUnit` → clean shape, slim refs). */
export const CalculationShoppingUnitDtoSchema = z
  .object({
    ingredient: CalculationIngredientRefSchema,
    unit: CalculationUnitRefSchema,
    checked: z.boolean(),
  })
  .openapi('CalculationShoppingUnit');

/** Slim calculation DTO for list views — group ref + slim items, no fully-hydrated cocktails. */
export const CalculationSummaryDtoSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    showSalesStuff: z.boolean(),
    updatedAt: DateTimeString,
    group: CalculationGroupRefSchema.nullable().openapi({ description: 'Group this calculation belongs to, or null.' }),
    items: z.array(CalculationItemDtoSchema),
  })
  .openapi('CalculationSummary');

/** Full calculation DTO — adds fully-hydrated cocktail items and ingredient shopping units. */
export const CalculationDtoSchema = CalculationSummaryDtoSchema.extend({
  ingredientShoppingUnits: z.array(CalculationShoppingUnitDtoSchema),
}).openapi('Calculation');

/** Group DTO — camelCase, `calculationCount` instead of `_count.calculations`, no `workspaceId`. */
export const CalculationGroupDtoSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    isDefaultExpanded: z.boolean(),
    calculationCount: z.number().int().openapi({ description: 'Number of calculations assigned to this group.' }),
  })
  .openapi('CalculationGroup');

export type CalculationCocktailRef = z.infer<typeof CalculationCocktailRefSchema>;
export type CalculationGroupRef = z.infer<typeof CalculationGroupRefSchema>;
export type CalculationItemDto = z.infer<typeof CalculationItemDtoSchema>;
export type CalculationShoppingUnitDto = z.infer<typeof CalculationShoppingUnitDtoSchema>;
export type CalculationSummaryDto = z.infer<typeof CalculationSummaryDtoSchema>;
export type CalculationDto = z.infer<typeof CalculationDtoSchema>;
export type CalculationGroupDto = z.infer<typeof CalculationGroupDtoSchema>;

/** Nested item input for create/update (mirrors the legacy `calculationItems: [{ cocktailId, plannedAmount, customPrice }]`). */
export const CalculationItemInputSchema = z.object({
  cocktailId: z.string(),
  plannedAmount: z.coerce.number().int().openapi({ description: 'Planned number of cocktails for this item.' }),
  customPrice: z.coerce.number().nullish().openapi({ description: 'Overridden price for this item, or null.' }),
});

/** Nested ingredient shopping unit input for create/update. */
export const CalculationShoppingUnitInputSchema = z.object({
  ingredientId: z.string(),
  unitId: z.string(),
  checked: z.coerce.boolean(),
});

export const CalculationCreateSchema = z
  .object({
    name: z.string().min(1),
    showSalesStuff: z.coerce.boolean().optional().openapi({ description: 'Whether to show sales figures (default true).' }),
    groupId: z.string().nullish().openapi({ description: 'Group to assign the calculation to, or null/omitted for none.' }),
    calculationItems: z.array(CalculationItemInputSchema).openapi({ description: 'Cocktail items in this calculation.' }),
    ingredientShoppingUnits: z.array(CalculationShoppingUnitInputSchema).openapi({ description: 'Ingredient shopping units for this calculation.' }),
  })
  .openapi('CalculationCreateInput');

export const CalculationUpdateSchema = z
  .object({
    name: z.string().min(1),
    showSalesStuff: z.coerce.boolean().optional().openapi({ description: 'Whether to show sales figures.' }),
    groupId: z.string().nullish().openapi({ description: 'Group to assign the calculation to; null/omitted disconnects it.' }),
    calculationItems: z.array(CalculationItemInputSchema).openapi({ description: 'Cocktail items; fully replaces the existing items.' }),
    ingredientShoppingUnits: z
      .array(CalculationShoppingUnitInputSchema)
      .openapi({ description: 'Ingredient shopping units; fully replaces the existing ones.' }),
  })
  .openapi('CalculationUpdateInput');

export const CalculationGroupCreateSchema = z
  .object({
    name: z.string().min(1),
    isDefaultExpanded: z.coerce.boolean().optional().openapi({ description: 'Whether the group is expanded by default (default false).' }),
  })
  .openapi('CalculationGroupCreateInput');

export const CalculationGroupUpdateSchema = z
  .object({
    name: z.string().min(1),
    isDefaultExpanded: z.coerce.boolean().optional().openapi({ description: 'Whether the group is expanded by default.' }),
  })
  .openapi('CalculationGroupUpdateInput');

export const CalculationGroupAssignSchema = z
  .object({
    calculationIds: z.array(z.string()).min(1).openapi({ description: 'Calculations to (re)assign.' }),
    groupId: z.string().nullish().openapi({ description: 'Target group, or null to remove group assignment.' }),
  })
  .openapi('CalculationGroupAssignInput');

export const CalculationItemParams = WorkspaceIdParam.extend({ calculationId: z.string() });
export const CalculationGroupItemParams = WorkspaceIdParam.extend({ groupId: z.string() });

export type CalculationCreateInput = z.infer<typeof CalculationCreateSchema>;
export type CalculationUpdateInput = z.infer<typeof CalculationUpdateSchema>;
export type CalculationGroupCreateInput = z.infer<typeof CalculationGroupCreateSchema>;
export type CalculationGroupUpdateInput = z.infer<typeof CalculationGroupUpdateSchema>;
export type CalculationGroupAssignInput = z.infer<typeof CalculationGroupAssignSchema>;

/** Export request body — ids of the calculations to dump (mirrors the legacy handler). */
export const CalculationExportJsonSchema = z
  .object({
    ids: z.array(z.string()).openapi({ description: 'Ids of the calculations to export.' }),
  })
  .openapi('CalculationExportJsonInput');
export type CalculationExportJsonInput = z.infer<typeof CalculationExportJsonSchema>;

/**
 * Import request body. The `exportData` payload MUST retain the exact raw shape
 * produced by the export endpoint (see lib/auditExport.ts,
 * CocktailCalculationExportStructure) so the export → import round-trip stays
 * lossless; hence it is modelled loosely (kept verbatim).
 */
export const CalculationImportJsonSchema = z
  .object({
    phase: z.enum(['validate', 'prepare-mapping', 'execute']).openapi({ description: 'Import phase to run.' }),
    exportData: z
      .any()
      .openapi({ description: 'Raw export dump (single object or array) as produced by POST /calculations/export/json (round-trip format, kept verbatim).' }),
    decisions: z.any().optional().openapi({ description: 'Per-entity import decisions, required for the "execute" phase.' }),
    cocktailMappings: z.any().optional().openapi({ description: 'Cocktail name → id mappings for the "execute" phase.' }),
    ingredientMappings: z.any().optional().openapi({ description: 'Ingredient name → id mappings for the "execute" phase.' }),
    unitMappings: z.any().optional().openapi({ description: 'Unit name → id mappings for the "execute" phase.' }),
  })
  .passthrough()
  .openapi('CalculationImportJsonInput');
export type CalculationImportJsonInput = z.infer<typeof CalculationImportJsonSchema>;

export const calculationsExportJsonApiDoc = {
  basePath: '/workspaces/{workspaceId}/calculations/export/json',
  legacyPath: false,
  operations: {
    POST: {
      roles: ['USER'],
      permission: null,
      tags: ['Calculations'],
      summary: 'Export calculations as JSON',
      description:
        'Returns a self-contained JSON dump of the selected calculations (metadata, cocktail items and ingredient shopping units, resolved to names) that can be re-imported via POST /calculations/import/json. A single selected calculation is returned as a bare object; multiple as an array. The exact dump shape is preserved verbatim for a lossless round-trip (not wrapped in a data envelope).',
      params: WorkspaceIdParam,
      body: CalculationExportJsonSchema,
      response: z
        .any()
        .openapi({ description: 'Raw export dump (see CocktailCalculationExportStructure). Returned verbatim, not wrapped in a data envelope.' }),
      errorResponses: { 400: 'No calculations selected.', 404: 'No calculations found.', 500: 'Export failed.' },
    },
  },
} satisfies ResourceApiDoc;

export const calculationsImportJsonApiDoc = {
  basePath: '/workspaces/{workspaceId}/calculations/import/json',
  legacyPath: false,
  operations: {
    POST: {
      roles: ['USER'],
      permission: 'CALCULATIONS_READ',
      tags: ['Calculations'],
      summary: 'Import calculations from JSON',
      description:
        'Three-phase import (`validate` → `prepare-mapping` → `execute`) of an export dump produced by POST /calculations/export/json. The response shape depends on the phase and is returned verbatim (not wrapped in a data envelope).',
      params: WorkspaceIdParam,
      body: CalculationImportJsonSchema,
      response: z
        .any()
        .openapi({ description: 'Phase-dependent import result (validation summary, mapping suggestions, or import results). Returned verbatim.' }),
      errorResponses: { 400: 'Invalid phase or missing decisions.', 500: 'Import failed.' },
    },
  },
} satisfies ResourceApiDoc;

export const calculationsCollectionApiDoc = {
  basePath: '/workspaces/{workspaceId}/calculations',
  legacyPath: true,
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'CALCULATIONS_READ',
      tags: ['Calculations'],
      summary: 'List calculations',
      description:
        'List all cocktail calculations of a workspace. Returns a slim summary (group ref + slim items); use GET /calculations/{calculationId} for the full calculation.',
      params: WorkspaceIdParam,
      response: z.array(CalculationSummaryDtoSchema),
    },
    POST: {
      roles: ['USER'],
      permission: 'CALCULATIONS_CREATE',
      tags: ['Calculations'],
      summary: 'Create calculation',
      params: WorkspaceIdParam,
      body: CalculationCreateSchema,
      response: CalculationSummaryDtoSchema,
      errorResponses: { 400: 'Invalid group.' },
    },
  },
} satisfies ResourceApiDoc;

export const calculationsItemApiDoc = {
  basePath: '/workspaces/{workspaceId}/calculations/{calculationId}',
  legacyPath: true,
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'CALCULATIONS_READ',
      tags: ['Calculations'],
      summary: 'Get calculation',
      description: 'Returns the full calculation including fully-hydrated cocktail items and ingredient shopping units.',
      params: CalculationItemParams,
      response: CalculationDtoSchema,
      errorResponses: { 404: 'Calculation not found.' },
    },
    PUT: {
      roles: ['USER'],
      permission: 'CALCULATIONS_UPDATE',
      tags: ['Calculations'],
      summary: 'Update calculation',
      description: 'Replaces the calculation metadata and its full set of items and ingredient shopping units.',
      params: CalculationItemParams,
      body: CalculationUpdateSchema,
      response: CalculationSummaryDtoSchema,
      errorResponses: { 400: 'Invalid group.' },
    },
    DELETE: {
      roles: ['ADMIN'],
      permission: 'CALCULATIONS_DELETE',
      tags: ['Calculations'],
      summary: 'Delete calculation',
      params: CalculationItemParams,
      response: DeletionResult,
    },
  },
} satisfies ResourceApiDoc;

export const calculationGroupsCollectionApiDoc = {
  basePath: '/workspaces/{workspaceId}/calculations/groups',
  legacyPath: true,
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'CALCULATIONS_READ',
      tags: ['Calculations'],
      summary: 'List calculation groups',
      description: 'List all calculation groups of a workspace, ordered by name.',
      params: WorkspaceIdParam,
      response: z.array(CalculationGroupDtoSchema),
    },
    POST: {
      roles: ['USER'],
      permission: 'CALCULATIONS_UPDATE',
      tags: ['Calculations'],
      summary: 'Create calculation group',
      params: WorkspaceIdParam,
      body: CalculationGroupCreateSchema,
      response: CalculationGroupDtoSchema,
      errorResponses: { 409: 'A group with this name already exists.' },
    },
  },
} satisfies ResourceApiDoc;

export const calculationGroupsItemApiDoc = {
  basePath: '/workspaces/{workspaceId}/calculations/groups/{groupId}',
  legacyPath: true,
  operations: {
    PUT: {
      roles: ['USER'],
      permission: 'CALCULATIONS_UPDATE',
      tags: ['Calculations'],
      summary: 'Update calculation group',
      params: CalculationGroupItemParams,
      body: CalculationGroupUpdateSchema,
      response: CalculationGroupDtoSchema,
      errorResponses: { 404: 'Group not found.', 409: 'A group with this name already exists.' },
    },
    DELETE: {
      roles: ['USER'],
      permission: 'CALCULATIONS_UPDATE',
      tags: ['Calculations'],
      summary: 'Delete calculation group',
      description: 'Deletes the group; its calculations are unassigned (group set to null).',
      params: CalculationGroupItemParams,
      response: DeletionResult,
      errorResponses: { 404: 'Group not found.' },
    },
  },
} satisfies ResourceApiDoc;

export const calculationGroupsAssignApiDoc = {
  basePath: '/workspaces/{workspaceId}/calculations/groups/assign',
  legacyPath: true,
  operations: {
    POST: {
      roles: ['USER'],
      permission: 'CALCULATIONS_UPDATE',
      tags: ['Calculations'],
      summary: 'Assign calculations to a group',
      description: 'Assigns the given calculations to a group, or removes their group assignment when groupId is null.',
      params: WorkspaceIdParam,
      body: CalculationGroupAssignSchema,
      response: z.object({ updatedCount: z.number().int() }).openapi('GroupAssignmentResult'),
      errorResponses: { 404: 'Group not found.' },
    },
  },
} satisfies ResourceApiDoc;
