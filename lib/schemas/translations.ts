/**
 * Zod schema + ResourceApiDoc for workspace display-name translations (v1).
 * Pure module (zod only). The endpoint merges per-language display names for a key
 * (action/unit/ice/… name) into the workspace `translations` setting.
 */
import { z } from '@lib/openapi/zod';
import { WorkspaceIdParam } from '@lib/schemas/common';
import type { ResourceApiDoc } from '@lib/openapi/types';

export const TranslationUpdateSchema = z
  .object({
    key: z.string().min(1).openapi({ description: 'The translation key (e.g. an action/unit/ice name).' }),
    translations: z.record(z.string(), z.string()).openapi({ description: 'Display names keyed by language code, e.g. { "de": "Shaken" }.' }),
  })
  .openapi('TranslationUpdateInput');

export const TranslationUpdateResultSchema = z.object({ ok: z.boolean() }).openapi('TranslationUpdateResult');

export type TranslationUpdateInput = z.infer<typeof TranslationUpdateSchema>;

export const translationsApiDoc = {
  basePath: '/workspaces/{workspaceId}/admin/translation',
  legacyPath: true,
  operations: {
    PUT: {
      roles: ['ADMIN'],
      permission: 'WORKSPACE_UPDATE',
      tags: ['Workspace'],
      summary: 'Upsert a translation',
      description: 'Merges display-name translations for a key into the workspace translation settings.',
      params: WorkspaceIdParam,
      body: TranslationUpdateSchema,
      response: TranslationUpdateResultSchema,
    },
  },
} satisfies ResourceApiDoc;
