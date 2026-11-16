/**
 * Zod schemas + ResourceApiDocs for templates (start content collections) and
 * applying them to a workspace. Spec: docs/plans/ONBOARDING-PLAN.md. Pure module.
 */
import { z } from '@lib/openapi/zod';
import { ApiTags } from '@lib/openapi/tags';
import { WorkspaceIdParam } from '@lib/schemas/common';
import { TEMPLATE_KINDS, TemplateKeySchema, TemplateLocaleSchema } from '@lib/templates/manifest';
import type { ResourceApiDoc } from '@lib/openapi/types';

export const TemplateKindEnum = z.enum(TEMPLATE_KINDS).openapi('TemplateKind', {
  description: '`BASE`: defaults of every new workspace, `CATALOG`: start content collection, `DEMO`: complete example bar.',
});

export const TemplateApplyModeEnum = z.enum(['all', 'basics', 'selection']).openapi('TemplateApplyMode', {
  description: '`all`: whole template, `basics`: glasses, ingredients and garnishes only, `selection`: the selected items plus their dependencies.',
});

const LocaleQuery = TemplateLocaleSchema.optional().openapi({
  description: 'Language for names and descriptions (falls back to the primary language of the template).',
  example: 'en',
});

export const TemplateKeyParam = z.object({ key: TemplateKeySchema.openapi({ description: 'Template key', example: 'all-time-classics' }) });

export const TemplateListQuerySchema = z.object({ kind: TemplateKindEnum.optional(), locale: LocaleQuery });
export const TemplateItemsQuerySchema = z.object({ locale: LocaleQuery });

export const TemplateCountsSchema = z
  .object({
    glasses: z.number().int(),
    ingredients: z.number().int(),
    garnishes: z.number().int(),
    cocktails: z.number().int(),
    cards: z.number().int(),
  })
  .openapi('TemplateCounts');

export const TemplateSummaryDtoSchema = z
  .object({
    key: z.string(),
    kind: TemplateKindEnum,
    name: z.string(),
    description: z.string().nullable(),
    locales: z.array(z.string()).openapi({ description: 'Content languages; the first one is the primary language.' }),
    builtIn: z.boolean(),
    version: z.number().int(),
    isDefault: z.boolean(),
    sortOrder: z.number().int(),
    counts: TemplateCountsSchema,
  })
  .openapi('TemplateSummary');

const TemplateItemSchema = z.object({ id: z.string(), name: z.string(), hasImage: z.boolean() });

export const TemplateItemsDtoSchema = z
  .object({
    key: z.string(),
    locale: z.string().openapi({ description: 'Language of the names.' }),
    glasses: z.array(TemplateItemSchema),
    ingredients: z.array(TemplateItemSchema),
    garnishes: z.array(TemplateItemSchema),
    cocktails: z.array(
      TemplateItemSchema.extend({
        glassId: z.string().nullable(),
        ingredientIds: z.array(z.string()),
        garnishIds: z.array(z.string()),
      }),
    ),
    cards: z.array(z.object({ id: z.string(), name: z.string(), cocktailIds: z.array(z.string()) })),
  })
  .openapi('TemplateItems', { description: 'Items of a template for a selection dialog; ids are only valid as selection of this template.' });

const SelectionIds = z.array(z.string().min(1).max(128)).max(1000).default([]);

export const TemplateSelectionSchema = z
  .object({ glasses: SelectionIds, ingredients: SelectionIds, garnishes: SelectionIds, cocktails: SelectionIds, cards: SelectionIds })
  .openapi('TemplateSelection', {
    description: 'Ids from `GET /templates/{key}/items`. Dependencies (glass, ingredients, garnishes of cocktails; cocktails of cards) are added.',
  });

export const TemplateApplyInputSchema = z
  .object({
    mode: TemplateApplyModeEnum,
    selection: TemplateSelectionSchema.optional(),
    locale: TemplateLocaleSchema.optional().openapi({
      description:
        'Content language of the workspace; template texts in this language become the primary texts. Default: primary content language of the workspace.',
    }),
  })
  .superRefine((input, ctx) => {
    if (input.mode === 'selection' && !input.selection)
      ctx.addIssue({ code: 'custom', path: ['selection'], message: 'selection is required for mode "selection"' });
  })
  .openapi('TemplateApplyInput');

export const TemplateApplyResultDtoSchema = z
  .object({
    template: z.string(),
    created: TemplateCountsSchema,
    linked: TemplateCountsSchema.openapi({ description: 'Items that already existed (same name in any language) and were reused.' }),
    skipped: TemplateCountsSchema.openapi({ description: 'Items that were not imported (cards with an existing name).' }),
  })
  .openapi('TemplateApplyResult');

export type TemplateListQuery = z.infer<typeof TemplateListQuerySchema>;
export type TemplateSummaryDto = z.infer<typeof TemplateSummaryDtoSchema>;
export type TemplateItemsDto = z.infer<typeof TemplateItemsDtoSchema>;
export type TemplateApplyInput = z.infer<typeof TemplateApplyInputSchema>;
export type TemplateApplyResultDto = z.infer<typeof TemplateApplyResultDtoSchema>;

/** API keys applying a template need the create scope of every kind of item a template may contain. */
export const TEMPLATE_APPLY_PERMISSIONS = ['COCKTAILS_CREATE', 'INGREDIENTS_CREATE', 'GLASSES_CREATE', 'GARNISHES_CREATE', 'CARDS_CREATE'] as const;

export const templatesCollectionApiDoc = {
  basePath: '/templates',
  operations: {
    GET: {
      roles: ['USER'],
      permission: null,
      auth: 'user',
      sessionOnly: true,
      tags: [ApiTags.templatesCore],
      summary: 'List templates',
      description: 'Published templates with names in the requested language and item counts, ordered by `sortOrder`.',
      query: TemplateListQuerySchema,
      response: z.array(TemplateSummaryDtoSchema),
    },
  },
} satisfies ResourceApiDoc;

export const templatesItemsApiDoc = {
  basePath: '/templates/{key}/items',
  operations: {
    GET: {
      roles: ['USER'],
      permission: null,
      auth: 'user',
      sessionOnly: true,
      tags: [ApiTags.templatesCore],
      summary: 'List template items',
      description: 'Glasses, ingredients, garnishes, cocktails (with their dependencies) and cards of a published template, for selecting what to apply.',
      params: TemplateKeyParam,
      query: TemplateItemsQuerySchema,
      response: TemplateItemsDtoSchema,
      errorResponses: { 404: 'Template not found or not published.' },
    },
  },
} satisfies ResourceApiDoc;

export const templatesApplyApiDoc = {
  basePath: '/workspaces/{workspaceId}/templates/{key}/apply',
  operations: {
    POST: {
      roles: ['MANAGER'],
      permission: 'COCKTAILS_CREATE',
      tags: [ApiTags.templatesCore],
      summary: 'Apply template',
      description:
        'Imports a published template (all, basics or a selection) in one transaction. Items with a name that already exists in the workspace (any language) are linked instead of created; catalog templates come without prices and with unconfirmed guest information. API keys additionally need `INGREDIENTS_CREATE`, `GLASSES_CREATE`, `GARNISHES_CREATE` and `CARDS_CREATE`.',
      params: WorkspaceIdParam.merge(TemplateKeyParam),
      body: TemplateApplyInputSchema,
      response: TemplateApplyResultDtoSchema,
      errorResponses: { 400: 'Invalid selection (`INVALID_SELECTION`).', 404: 'Template not found or not published.' },
    },
  },
} satisfies ResourceApiDoc;
