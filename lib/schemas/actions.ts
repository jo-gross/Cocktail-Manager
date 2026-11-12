/**
 * Zod schemas + ResourceApiDocs for cocktail-recipe step Actions (v1).
 * Pure module (zod only) so scripts/generate-openapi.ts can import it without the
 * Prisma runtime. Responses describe the clean public DTO (see lib/api/dto/actions.ts),
 * NOT the raw Prisma shape. Actions are the workspace's cocktail-building vocabulary
 * (SHAKE, STIR, …), so they reuse the `COCKTAILS_*` permission scopes.
 */
import { z } from '@lib/openapi/zod';
import { ApiTags } from '@lib/openapi/tags';
import { WorkspaceIdParam } from '@lib/schemas/common';
import type { ResourceApiDoc } from '@lib/openapi/types';

/** Public step-action DTO — no `workspaceId` (implied by the path). */
export const ActionDtoSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    actionGroup: z.string().openapi({ description: 'Grouping bucket, e.g. "MIXING" or "POURING".' }),
    dilutionPercent: z.number().nullable().openapi({
      description: 'Water added by this action in % of the liquid volume (for ABV calculation); null = default (SHAKE 25, STIR 20, otherwise 10).',
    }),
  })
  .openapi('Action');

export type ActionDto = z.infer<typeof ActionDtoSchema>;

/** Dilution in % (0–100); null resets to the default for the action. */
const DilutionPercentSchema = z.coerce
  .number()
  .min(0)
  .max(100)
  .nullish()
  .openapi({ description: 'Dilution in % of the liquid volume; null = default for the action. Omit to keep unchanged.' });

/** Optional per-language display-name overrides, keyed by language code. */
const TranslationsSchema = z
  .record(z.string(), z.string())
  .openapi({ description: 'Optional display-name translations keyed by language code, e.g. { "en": "Shake" }.' });

export const ActionCreateSchema = z
  .object({
    name: z.string().min(1),
    actionGroup: z.string().min(1),
    dilutionPercent: DilutionPercentSchema,
    translations: TranslationsSchema.optional(),
  })
  .openapi('ActionCreateInput');

export const ActionUpdateSchema = z
  .object({
    actionGroup: z.string().min(1),
    dilutionPercent: DilutionPercentSchema,
    translations: TranslationsSchema.optional(),
  })
  .openapi('ActionUpdateInput');

export const ActionListQuerySchema = z.object({
  search: z.string().optional().openapi({ description: 'Case-insensitive name filter.' }),
});

export const ActionItemParams = WorkspaceIdParam.extend({ actionId: z.string() });

export type ActionCreateInput = z.infer<typeof ActionCreateSchema>;
export type ActionUpdateInput = z.infer<typeof ActionUpdateSchema>;
export type ActionListQuery = z.infer<typeof ActionListQuerySchema>;

export const actionsCollectionApiDoc = {
  basePath: '/workspaces/{workspaceId}/actions',
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'COCKTAILS_READ',
      tags: [ApiTags.cocktailsStepActions],
      summary: 'List step actions',
      description: 'List all cocktail-recipe step actions of a workspace, optionally filtered by name.',
      params: WorkspaceIdParam,
      query: ActionListQuerySchema,
      response: z.array(ActionDtoSchema),
    },
    POST: {
      roles: ['ADMIN'],
      permission: 'COCKTAILS_UPDATE',
      tags: [ApiTags.cocktailsStepActions],
      summary: 'Create step action',
      params: WorkspaceIdParam,
      body: ActionCreateSchema,
      response: ActionDtoSchema,
    },
  },
} satisfies ResourceApiDoc;

export const actionsItemApiDoc = {
  basePath: '/workspaces/{workspaceId}/actions/{actionId}',
  operations: {
    PUT: {
      roles: ['ADMIN'],
      permission: 'COCKTAILS_UPDATE',
      tags: [ApiTags.cocktailsStepActions],
      summary: 'Update step action',
      description: 'Updates the action group and (optionally) the display-name translations.',
      params: ActionItemParams,
      body: ActionUpdateSchema,
      response: ActionDtoSchema,
      errorResponses: { 404: 'Action not found.' },
    },
    DELETE: {
      roles: ['ADMIN'],
      permission: 'COCKTAILS_UPDATE',
      tags: [ApiTags.cocktailsStepActions],
      summary: 'Delete step action',
      params: ActionItemParams,
      response: ActionDtoSchema,
      errorResponses: { 404: 'Action not found.' },
    },
  },
} satisfies ResourceApiDoc;
