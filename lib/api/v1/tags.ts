/**
 * v1 handler wiring for tags: validated, typed ctx → shared controller
 * (which returns the clean DTO).
 */
import { tagsCollectionApiDoc } from '@lib/schemas/tags';
import { defineApiHandlers } from '@lib/openapi/apiDoc';
import * as tags from '@lib/api/controllers/tags';

export const collectionHandler = defineApiHandlers(tagsCollectionApiDoc.operations, {
  GET: ({ workspace }) => tags.listTags(workspace),
});
