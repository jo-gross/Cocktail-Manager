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
import { ApiTags } from '@lib/openapi/tags';
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

// ────────────── Input bounds ──────────────

export const MAX_CALCULATION_NAME_LENGTH = 255;
export const MAX_CALCULATION_GROUP_NAME_LENGTH = 100;
export const MAX_CALCULATION_ITEMS = 500;
export const MAX_CALCULATION_SHOPPING_UNITS = 2000;
export const MAX_CALCULATION_IDS = 500;
const MAX_PLANNED_AMOUNT = 1_000_000;
const MAX_PRICE = 1_000_000;
const MAX_ID_LENGTH = 100;
const MAX_REFERENCE_NAME_LENGTH = 255;

const IdString = z.string().min(1).max(MAX_ID_LENGTH);
const PlannedAmount = z.coerce.number().int().min(0).max(MAX_PLANNED_AMOUNT);
const Price = z.coerce.number().min(0).max(MAX_PRICE);

/** Nested item input for create/update (mirrors the legacy `calculationItems: [{ cocktailId, plannedAmount, customPrice }]`). */
export const CalculationItemInputSchema = z.object({
  cocktailId: IdString,
  plannedAmount: PlannedAmount.openapi({ description: 'Planned number of cocktails for this item.' }),
  customPrice: Price.nullish().openapi({ description: 'Overridden price for this item, or null.' }),
});

/** Nested ingredient shopping unit input for create/update. */
export const CalculationShoppingUnitInputSchema = z.object({
  ingredientId: IdString,
  unitId: IdString,
  checked: z.coerce.boolean(),
});

export const CalculationCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(MAX_CALCULATION_NAME_LENGTH),
    showSalesStuff: z.coerce.boolean().optional().openapi({ description: 'Whether to show sales figures (default true).' }),
    groupId: IdString.nullish().openapi({ description: 'Group to assign the calculation to, or null/omitted for none.' }),
    calculationItems: z.array(CalculationItemInputSchema).max(MAX_CALCULATION_ITEMS).openapi({ description: 'Cocktail items in this calculation.' }),
    ingredientShoppingUnits: z
      .array(CalculationShoppingUnitInputSchema)
      .max(MAX_CALCULATION_SHOPPING_UNITS)
      .openapi({ description: 'Ingredient shopping units for this calculation.' }),
  })
  .openapi('CalculationCreateInput');

export const CalculationUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(MAX_CALCULATION_NAME_LENGTH),
    showSalesStuff: z.coerce.boolean().optional().openapi({ description: 'Whether to show sales figures.' }),
    groupId: IdString.nullish().openapi({ description: 'Group to assign the calculation to; null/omitted disconnects it.' }),
    calculationItems: z
      .array(CalculationItemInputSchema)
      .max(MAX_CALCULATION_ITEMS)
      .openapi({ description: 'Cocktail items; fully replaces the existing items.' }),
    ingredientShoppingUnits: z
      .array(CalculationShoppingUnitInputSchema)
      .max(MAX_CALCULATION_SHOPPING_UNITS)
      .openapi({ description: 'Ingredient shopping units; fully replaces the existing ones.' }),
  })
  .openapi('CalculationUpdateInput');

export const CalculationGroupCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(MAX_CALCULATION_GROUP_NAME_LENGTH),
    isDefaultExpanded: z.coerce.boolean().optional().openapi({ description: 'Whether the group is expanded by default (default false).' }),
  })
  .openapi('CalculationGroupCreateInput');

export const CalculationGroupUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(MAX_CALCULATION_GROUP_NAME_LENGTH),
    isDefaultExpanded: z.coerce.boolean().optional().openapi({ description: 'Whether the group is expanded by default.' }),
  })
  .openapi('CalculationGroupUpdateInput');

export const CalculationGroupAssignSchema = z
  .object({
    calculationIds: z.array(IdString).min(1).max(MAX_CALCULATION_IDS).openapi({ description: 'Calculations to (re)assign.' }),
    groupId: IdString.nullish().openapi({ description: 'Target group, or null to remove group assignment.' }),
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
    ids: z.array(IdString).max(MAX_CALCULATION_IDS).openapi({ description: 'Ids of the calculations to export.' }),
  })
  .openapi('CalculationExportJsonInput');
export type CalculationExportJsonInput = z.infer<typeof CalculationExportJsonSchema>;

export const MAX_CALCULATION_IMPORT_ITEMS = 500;
const MAX_IMPORT_MAPPINGS = 5000;

/**
 * One calculation of an export dump (see lib/auditExport.ts,
 * CocktailCalculationExportStructure). Only the fields the import reads are
 * checked; everything else (ids, export metadata) passes through untouched.
 */
export const CalculationExportItemSchema = z
  .object({
    calculation: z
      .object({
        name: z.string().trim().min(1).max(MAX_CALCULATION_NAME_LENGTH),
        showSalesStuff: z.boolean().optional(),
        groupName: z.string().max(MAX_CALCULATION_GROUP_NAME_LENGTH).nullish(),
      })
      .passthrough(),
    cocktailCalculationItems: z
      .array(
        z
          .object({
            cocktailName: z.string().min(1).max(MAX_REFERENCE_NAME_LENGTH),
            plannedAmount: z.number().int().min(0).max(MAX_PLANNED_AMOUNT),
            customPrice: z.number().min(0).max(MAX_PRICE).nullish(),
          })
          .passthrough(),
      )
      .max(MAX_CALCULATION_ITEMS)
      .default([]),
    ingredientShoppingUnits: z
      .array(
        z
          .object({
            ingredientName: z.string().min(1).max(MAX_REFERENCE_NAME_LENGTH),
            unitName: z.string().min(1).max(MAX_REFERENCE_NAME_LENGTH),
            checked: z.boolean().optional(),
          })
          .passthrough(),
      )
      .max(MAX_CALCULATION_SHOPPING_UNITS)
      .default([]),
  })
  .passthrough();
export type CalculationExportItem = z.infer<typeof CalculationExportItemSchema>;

export const CalculationImportDecisionSchema = z.object({
  exportName: z.string().max(MAX_CALCULATION_NAME_LENGTH),
  decision: z.enum(['import', 'overwrite', 'rename', 'skip']),
  existingId: IdString.nullish(),
  newName: z.string().max(MAX_CALCULATION_NAME_LENGTH).nullish(),
  groupDecision: z.enum(['keep-exported', 'use-existing', 'create-new', 'no-group']).nullish(),
  existingGroupId: IdString.nullish(),
  newGroupName: z.string().max(MAX_CALCULATION_GROUP_NAME_LENGTH).nullish(),
  newGroupDefaultExpanded: z.boolean().nullish(),
  /** One item of the export dump; validated per item by the controller so issues can be reported per decision. */
  data: z.unknown(),
});
export type CalculationImportDecision = z.infer<typeof CalculationImportDecisionSchema>;

export const CalculationImportMappingSchema = z.object({
  exportName: z.string().max(MAX_REFERENCE_NAME_LENGTH),
  decision: z.enum(['use-existing', 'skip']),
  existingId: IdString.nullish(),
});
export type CalculationImportMapping = z.infer<typeof CalculationImportMappingSchema>;

/**
 * Import request body. `exportData` keeps the raw shape produced by the export
 * endpoint (round-trip format) and is validated per item by the controller so
 * the validate phase can report invalid items instead of rejecting the request.
 */
export const CalculationImportJsonSchema = z
  .object({
    phase: z.enum(['validate', 'prepare-mapping', 'execute']).openapi({ description: 'Import phase to run.' }),
    exportData: z
      .unknown()
      .optional()
      .openapi({ description: 'Raw export dump (single object or array) as produced by POST /calculations/export/json (round-trip format, kept verbatim).' }),
    decisions: z
      .array(CalculationImportDecisionSchema)
      .max(MAX_CALCULATION_IMPORT_ITEMS)
      .optional()
      .openapi({ description: 'Per-entity import decisions, required for the "execute" phase.' }),
    cocktailMappings: z
      .array(CalculationImportMappingSchema)
      .max(MAX_IMPORT_MAPPINGS)
      .optional()
      .openapi({ description: 'Cocktail name → id mappings for the "execute" phase.' }),
    ingredientMappings: z
      .array(CalculationImportMappingSchema)
      .max(MAX_IMPORT_MAPPINGS)
      .optional()
      .openapi({ description: 'Ingredient name → id mappings for the "execute" phase.' }),
    unitMappings: z
      .array(CalculationImportMappingSchema)
      .max(MAX_IMPORT_MAPPINGS)
      .optional()
      .openapi({ description: 'Unit name → id mappings for the "execute" phase.' }),
  })
  .openapi('CalculationImportJsonInput');
export type CalculationImportJsonInput = z.infer<typeof CalculationImportJsonSchema>;

export const calculationsExportJsonApiDoc = {
  basePath: '/workspaces/{workspaceId}/calculations/export/json',
  operations: {
    POST: {
      roles: ['USER'],
      permission: 'CALCULATIONS_READ',
      tags: [ApiTags.calculationsImportExport],
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
  operations: {
    POST: {
      roles: ['USER'],
      permission: 'CALCULATIONS_CREATE',
      tags: [ApiTags.calculationsImportExport],
      summary: 'Import calculations from JSON',
      description:
        'Three-phase import (`validate` → `prepare-mapping` → `execute`) of an export dump produced by POST /calculations/export/json. The response shape depends on the phase and is returned verbatim (not wrapped in a data envelope). ' +
        'The execute phase is all-or-nothing: every decision and referenced id is validated first; any invalid item or foreign/unknown id writes nothing and returns 400 with per-item issues. ' +
        'All writes run in one transaction. Not available to the instance master key (calculations record the updating user).',
      params: WorkspaceIdParam,
      body: CalculationImportJsonSchema,
      response: z
        .any()
        .openapi({ description: 'Phase-dependent import result (validation summary, mapping suggestions, or import results). Returned verbatim.' }),
      errorResponses: {
        400: 'Invalid phase, missing decisions, invalid items or references (nothing was imported).',
        403: 'Master API key cannot write calculations.',
        409: 'Conflict with a concurrent change (nothing was imported).',
      },
    },
  },
} satisfies ResourceApiDoc;

export const calculationsCollectionApiDoc = {
  basePath: '/workspaces/{workspaceId}/calculations',
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'CALCULATIONS_READ',
      tags: [ApiTags.calculationsCore],
      summary: 'List calculations',
      description:
        'List all cocktail calculations of a workspace. Returns a slim summary (group ref + slim items); use GET /calculations/{calculationId} for the full calculation.',
      params: WorkspaceIdParam,
      response: z.array(CalculationSummaryDtoSchema),
    },
    POST: {
      roles: ['USER'],
      permission: 'CALCULATIONS_CREATE',
      tags: [ApiTags.calculationsCore],
      summary: 'Create calculation',
      description: 'Not available to the instance master key (calculations record the updating user).',
      params: WorkspaceIdParam,
      body: CalculationCreateSchema,
      response: CalculationSummaryDtoSchema,
      errorResponses: {
        400: 'Invalid group, or a cocktail/ingredient/unit that does not exist in this workspace.',
        403: 'Master API key cannot write calculations.',
      },
    },
  },
} satisfies ResourceApiDoc;

export const calculationsItemApiDoc = {
  basePath: '/workspaces/{workspaceId}/calculations/{calculationId}',
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'CALCULATIONS_READ',
      tags: [ApiTags.calculationsCore],
      summary: 'Get calculation',
      description: 'Returns the full calculation including fully-hydrated cocktail items and ingredient shopping units.',
      params: CalculationItemParams,
      response: CalculationDtoSchema,
      errorResponses: { 404: 'Calculation not found.' },
    },
    PUT: {
      roles: ['USER'],
      permission: 'CALCULATIONS_UPDATE',
      tags: [ApiTags.calculationsCore],
      summary: 'Update calculation',
      description:
        'Replaces the calculation metadata and its full set of items and ingredient shopping units. Not available to the instance master key (calculations record the updating user).',
      params: CalculationItemParams,
      body: CalculationUpdateSchema,
      response: CalculationSummaryDtoSchema,
      errorResponses: {
        400: 'Invalid group, or a cocktail/ingredient/unit that does not exist in this workspace.',
        403: 'Master API key cannot write calculations.',
        404: 'Calculation not found.',
      },
    },
    DELETE: {
      roles: ['ADMIN'],
      permission: 'CALCULATIONS_DELETE',
      tags: [ApiTags.calculationsCore],
      summary: 'Delete calculation',
      params: CalculationItemParams,
      response: DeletionResult,
      errorResponses: { 404: 'Calculation not found.' },
    },
  },
} satisfies ResourceApiDoc;

export const calculationGroupsCollectionApiDoc = {
  basePath: '/workspaces/{workspaceId}/calculations/groups',
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'CALCULATIONS_READ',
      tags: [ApiTags.calculationsGroups],
      summary: 'List calculation groups',
      description: 'List all calculation groups of a workspace, ordered by name.',
      params: WorkspaceIdParam,
      response: z.array(CalculationGroupDtoSchema),
    },
    POST: {
      roles: ['USER'],
      permission: 'CALCULATIONS_UPDATE',
      tags: [ApiTags.calculationsGroups],
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
  operations: {
    PUT: {
      roles: ['USER'],
      permission: 'CALCULATIONS_UPDATE',
      tags: [ApiTags.calculationsGroups],
      summary: 'Update calculation group',
      params: CalculationGroupItemParams,
      body: CalculationGroupUpdateSchema,
      response: CalculationGroupDtoSchema,
      errorResponses: { 404: 'Group not found.', 409: 'A group with this name already exists.' },
    },
    DELETE: {
      roles: ['USER'],
      permission: 'CALCULATIONS_UPDATE',
      tags: [ApiTags.calculationsGroups],
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
  operations: {
    POST: {
      roles: ['USER'],
      permission: 'CALCULATIONS_UPDATE',
      tags: [ApiTags.calculationsGroups],
      summary: 'Assign calculations to a group',
      description: 'Assigns the given calculations to a group, or removes their group assignment when groupId is null.',
      params: WorkspaceIdParam,
      body: CalculationGroupAssignSchema,
      response: z.object({ updatedCount: z.number().int() }).openapi('GroupAssignmentResult'),
      errorResponses: { 400: 'A calculation does not exist in this workspace.', 404: 'Group not found.' },
    },
  },
} satisfies ResourceApiDoc;
