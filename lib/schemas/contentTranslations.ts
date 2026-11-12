/**
 * Zod schemas + ResourceApiDoc for content translations (v1): translations of
 * cocktail / ingredient / garnish / glass texts stored in the *Translation
 * tables. Pure module (zod only). Not to be confused with the display-name
 * catalog in lib/schemas/translations.ts.
 */
import { z } from '@lib/openapi/zod';
import { WorkspaceIdParam } from '@lib/schemas/common';
import { ApiTags } from '@lib/openapi/tags';
import type { ResourceApiDoc } from '@lib/openapi/types';
import { ALL_CONTENT_TRANSLATION_FIELDS, CONTENT_TRANSLATION_ENTITY_TYPES, isTranslatableField } from '@lib/translations/contentTranslationFields';
import { isValidContentLocale } from '@lib/workspace/workspaceLocaleSettings';

const EntityTypeSchema = z.enum(CONTENT_TRANSLATION_ENTITY_TYPES).openapi({ description: 'Entity type.' });
const FieldSchema = z.enum(ALL_CONTENT_TRANSLATION_FIELDS).openapi({
  description: 'Translatable field. cocktail: name/description/history, ingredient: name/guestName/description, garnish: name/description, glass: name.',
});
/** Upper bound for one translated text (descriptions and histories are the longest fields). */
export const CONTENT_TRANSLATION_VALUE_MAX_LENGTH = 10_000;
/** Upper bound for items per bulk request (a CSV import sends all rows at once). */
export const CONTENT_TRANSLATION_MAX_ITEMS = 20_000;

const LocaleSchema = z.string().max(35).refine(isValidContentLocale, { message: 'Invalid locale code' }).openapi({ example: 'en' });

export const ContentTranslationRowSchema = z
  .object({
    entityType: EntityTypeSchema,
    entityId: z.string(),
    entityName: z.string().openapi({ description: 'Entity name in the primary content language (for context).' }),
    field: FieldSchema,
    locale: z.string(),
    source: z.string().nullable().openapi({ description: 'Value in the primary content language.' }),
    value: z.string().nullable().openapi({ description: 'Translated value, or null when missing.' }),
  })
  .openapi('ContentTranslationRow');

export type ContentTranslationRow = z.infer<typeof ContentTranslationRowSchema>;

export const ContentTranslationsDtoSchema = z
  .object({
    primaryLocale: z.string().openapi({ description: 'Primary content language (source of `source`).' }),
    locales: z.array(z.string()).openapi({ description: 'Locales included in `rows`.' }),
    rows: z.array(ContentTranslationRowSchema),
  })
  .openapi('ContentTranslations');

export type ContentTranslationsDto = z.infer<typeof ContentTranslationsDtoSchema>;

export const ContentTranslationsQuerySchema = z.object({
  locale: LocaleSchema.optional().openapi({ description: 'Target locale. Defaults to all additional content locales of the workspace.' }),
  entity: EntityTypeSchema.optional().openapi({ description: 'Only rows of this entity type.' }),
  entityId: z.string().max(100).optional().openapi({ description: 'Only rows of this entity (requires `entity`).' }),
  missingOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true')
    .openapi({ description: 'Only rows whose translation is missing (source present, value empty).' }),
});

export type ContentTranslationsQuery = z.infer<typeof ContentTranslationsQuerySchema>;

export const ContentTranslationUpsertItemSchema = z
  .object({
    entityType: EntityTypeSchema,
    entityId: z.string().min(1).max(100),
    field: FieldSchema,
    locale: LocaleSchema,
    value: z.string().max(CONTENT_TRANSLATION_VALUE_MAX_LENGTH).nullable().openapi({ description: 'Translated value; null or empty string clears it.' }),
  })
  .superRefine((item, ctx) => {
    if (!isTranslatableField(item.entityType, item.field)) {
      ctx.addIssue({ code: 'custom', path: ['field'], message: `Field "${item.field}" is not translatable for ${item.entityType}` });
    }
  })
  .openapi('ContentTranslationUpsertItem');

export const ContentTranslationsUpdateSchema = z
  .object({
    items: z.array(ContentTranslationUpsertItemSchema).max(CONTENT_TRANSLATION_MAX_ITEMS),
  })
  .openapi('ContentTranslationsUpdateInput');

export type ContentTranslationsUpdateInput = z.infer<typeof ContentTranslationsUpdateSchema>;

export const ContentTranslationsUpdateResultSchema = z
  .object({
    updated: z.number().int().openapi({ description: 'Number of items written.' }),
    skipped: z.number().int().openapi({ description: 'Items ignored because the entity does not exist in this workspace.' }),
  })
  .openapi('ContentTranslationsUpdateResult');

export type ContentTranslationsUpdateResult = z.infer<typeof ContentTranslationsUpdateResultSchema>;

export const contentTranslationsApiDoc = {
  basePath: '/workspaces/{workspaceId}/translations/content',
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'TRANSLATIONS_READ',
      tags: [ApiTags.contentTranslations],
      summary: 'List content translations',
      description:
        'Returns one row per entity, translatable field and locale with the primary-language source value and the translation. Rows without source and translation are omitted. Internal notes are never translatable.',
      params: WorkspaceIdParam,
      query: ContentTranslationsQuerySchema,
      response: ContentTranslationsDtoSchema,
      errorResponses: { 400: 'The requested locale is the primary content language.' },
    },
    PUT: {
      roles: ['MANAGER'],
      permission: 'TRANSLATIONS_UPDATE',
      tags: [ApiTags.contentTranslations],
      summary: 'Bulk upsert content translations',
      description:
        'Writes translated values per entity, field and locale in one transaction. Empty values clear a translation. Items of entities that do not exist in this workspace are skipped (counted in `skipped`).',
      params: WorkspaceIdParam,
      body: ContentTranslationsUpdateSchema,
      response: ContentTranslationsUpdateResultSchema,
      errorResponses: { 400: 'A locale equals the primary content language.' },
    },
  },
} satisfies ResourceApiDoc;
