/**
 * Zod schema + ResourceApiDocs for workspace display-name translations (v1).
 * Pure module (zod only). Translations are a content resource (parsed catalog),
 * separate from scalar workspace settings.
 */
import { z } from '@lib/openapi/zod';
import { WorkspaceIdParam } from '@lib/schemas/common';
import { ApiTags } from '@lib/openapi/tags';
import type { ResourceApiDoc } from '@lib/openapi/types';
import { isValidContentLocale } from '@lib/workspace/workspaceLocaleSettings';

export const TRANSLATION_KEY_MAX_LENGTH = 200;
export const TRANSLATION_VALUE_MAX_LENGTH = 500;
export const TRANSLATION_MAX_LANGUAGES = 50;

/** Names that would hit `Object.prototype` when used as keys of the stored JSON blob. */
const RESERVED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** A display-name key (the action/unit/ice name), bounded and never a prototype key. */
export const TranslationKeySchema = z
  .string()
  .min(1)
  .max(TRANSLATION_KEY_MAX_LENGTH)
  .refine((key) => !RESERVED_KEYS.has(key), { message: 'Reserved translation key' });

/** Display names keyed by language code (BCP 47, e.g. `de`, `en-GB`); bounded in size. */
export const LabelTranslationsSchema = z
  .record(z.string().refine(isValidContentLocale, { message: 'Invalid language code' }), z.string().max(TRANSLATION_VALUE_MAX_LENGTH))
  .refine((translations) => Object.keys(translations).length <= TRANSLATION_MAX_LANGUAGES, {
    message: `At most ${TRANSLATION_MAX_LANGUAGES} languages`,
  });

/** Parsed translation catalog: language → key → display name. */
export const TranslationsDtoSchema = z
  .record(z.string(), z.record(z.string(), z.string()))
  .openapi('Translations', { description: 'Display-name catalog keyed by language code, then by translation key.' });

export type TranslationsDto = z.infer<typeof TranslationsDtoSchema>;

export const TranslationUpdateSchema = z
  .object({
    key: TranslationKeySchema.openapi({ description: 'The translation key (e.g. an action/unit/ice name).' }),
    translations: LabelTranslationsSchema.openapi({ description: 'Display names keyed by language code, e.g. { "de": "Shaken" }.' }),
  })
  .openapi('TranslationUpdateInput');

export const TranslationUpdateResultSchema = z.object({ ok: z.boolean() }).openapi('TranslationUpdateResult');

export type TranslationUpdateInput = z.infer<typeof TranslationUpdateSchema>;

/** Canonical translations resource: GET catalog + PUT merge a key. */
export const translationsCollectionApiDoc = {
  basePath: '/workspaces/{workspaceId}/translations',
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'WORKSPACE_READ',
      tags: [ApiTags.workspaceSettings],
      summary: 'Get translations',
      description: 'Return the workspace display-name translation catalog as a parsed object.',
      params: WorkspaceIdParam,
      response: TranslationsDtoSchema,
    },
    PUT: {
      roles: ['ADMIN'],
      permission: 'WORKSPACE_UPDATE',
      tags: [ApiTags.workspaceSettings],
      summary: 'Upsert a translation',
      description: 'Merges display-name translations for a key into the workspace translation catalog.',
      params: WorkspaceIdParam,
      body: TranslationUpdateSchema,
      response: TranslationUpdateResultSchema,
    },
  },
} satisfies ResourceApiDoc;

/**
 * Legacy admin path kept for backward compatibility (same PUT semantics as
 * translationsCollectionApiDoc). Prefer `/translations`.
 */
export const translationsApiDoc = {
  basePath: '/workspaces/{workspaceId}/admin/translation',
  operations: {
    PUT: {
      roles: ['ADMIN'],
      permission: 'WORKSPACE_UPDATE',
      tags: [ApiTags.workspaceSettings],
      summary: 'Upsert a translation',
      description: 'Merges display-name translations for a key into the workspace translation settings. Prefer PUT /translations.',
      params: WorkspaceIdParam,
      body: TranslationUpdateSchema,
      response: TranslationUpdateResultSchema,
    },
  },
} satisfies ResourceApiDoc;
