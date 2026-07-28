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
  })
  .openapi('Action');

export type ActionDto = z.infer<typeof ActionDtoSchema>;

/** Optional per-language display-name overrides, keyed by language code. */
const TranslationsSchema = z
  .record(z.string(), z.string())
  .openapi({ description: 'Optional display-name translations keyed by language code, e.g. { "en": "Shake" }.' });

export const ActionCreateSchema = z
  .object({
    name: z.string().min(1),
    actionGroup: z.string().min(1),
    translations: TranslationsSchema.optional(),
  })
  .openapi('ActionCreateInput');

export const ActionUpdateSchema = z
  .object({
    actionGroup: z.string().min(1),
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
  legacyPath: true,
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
  legacyPath: true,
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
