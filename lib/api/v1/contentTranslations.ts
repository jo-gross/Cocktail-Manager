/**
 * v1 handler wiring for content translations: validated, typed ctx → shared controller.
 */
import { contentTranslationsApiDoc } from '@lib/schemas/contentTranslations';
import { defineApiHandlers } from '@lib/openapi/apiDoc';
import * as contentTranslations from '@lib/api/controllers/contentTranslations';

export const contentTranslationsHandler = defineApiHandlers(contentTranslationsApiDoc.operations, {
  GET: ({ workspace, query }) => contentTranslations.listContentTranslations(workspace, query),
  PUT: ({ workspace, body }) => contentTranslations.upsertContentTranslations(workspace, body),
});
