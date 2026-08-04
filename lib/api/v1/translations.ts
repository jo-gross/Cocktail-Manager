/**
 * v1 handler wiring for workspace translations: validated, typed ctx → shared controller.
 */
import { translationsApiDoc } from '@lib/schemas/translations';
import { defineApiHandlers } from '@lib/openapi/apiDoc';
import * as translations from '@lib/api/controllers/translations';

export const translationHandler = defineApiHandlers(translationsApiDoc.operations, {
  PUT: ({ workspace, body }) => translations.setTranslation(workspace, body),
});
