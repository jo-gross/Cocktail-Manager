/**
 * v1 handler wiring for workspace translations: validated, typed ctx → shared controller.
 */
import { translationsApiDoc, translationsCollectionApiDoc } from '@lib/schemas/translations';
import { defineApiHandlers } from '@lib/openapi/apiDoc';
import * as translations from '@lib/api/controllers/translations';
import { STATUS_VIEW, withStatusExemption } from '@lib/entitlements/statusGate';

/** The app shell reads the translations on every workspace load, so `GET` stays open in a suspended workspace. */
export const translationsCollectionHandler = withStatusExemption(
  { GET: STATUS_VIEW },
  defineApiHandlers(translationsCollectionApiDoc.operations, {
    GET: ({ workspace }) => translations.getTranslations(workspace),
    PUT: ({ workspace, body }) => translations.setTranslation(workspace, body),
  }),
);

/** Legacy admin path — same PUT as the collection handler. */
export const translationHandler = defineApiHandlers(translationsApiDoc.operations, {
  PUT: ({ workspace, body }) => translations.setTranslation(workspace, body),
});
