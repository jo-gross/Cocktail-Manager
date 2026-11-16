/** v1 handler wiring for the guide progress of the session user (no workspace, no API keys). */
import { guidesCollectionApiDoc, guidesItemApiDoc } from '@lib/schemas/guides';
import { defineApiHandlers } from '@lib/openapi/apiDoc';
import * as guides from '@lib/api/controllers/guides';

export const collectionHandler = defineApiHandlers(guidesCollectionApiDoc.operations, {
  GET: ({ user }) => guides.listGuideProgress(user),
});

export const itemHandler = defineApiHandlers(guidesItemApiDoc.operations, {
  PUT: ({ user, params, body }) => guides.setGuideProgress(user, params.guideId, body),
});
