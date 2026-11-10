/**
 * v1 handler wiring for tags: validated, typed ctx → shared controller
 * (which returns the clean DTO).
 */
import {
  tagCategoriesCollectionApiDoc,
  tagCategoriesDefaultsApiDoc,
  tagCategoriesItemApiDoc,
  tagDefinitionsApiDoc,
  tagsCollectionApiDoc,
} from '@lib/schemas/tags';
import { defineApiHandlers } from '@lib/openapi/apiDoc';
import * as tags from '@lib/api/controllers/tags';

export const collectionHandler = defineApiHandlers(tagsCollectionApiDoc.operations, {
  GET: ({ workspace }) => tags.listTags(workspace),
});

export const categoriesCollectionHandler = defineApiHandlers(tagCategoriesCollectionApiDoc.operations, {
  GET: ({ workspace }) => tags.listTagCategories(workspace),
  POST: ({ workspace, body }) => tags.createTagCategory(workspace, body),
  PUT: ({ workspace, body }) => tags.upsertTagCategories(workspace, body),
});

export const categoriesItemHandler = defineApiHandlers(tagCategoriesItemApiDoc.operations, {
  PUT: ({ workspace, params, body }) => tags.updateTagCategory(workspace, params.categoryId, body),
  DELETE: ({ workspace, params }) => tags.deleteTagCategory(workspace, params.categoryId),
});

export const categoriesDefaultsHandler = defineApiHandlers(tagCategoriesDefaultsApiDoc.operations, {
  POST: ({ workspace }) => tags.createDefaultTagCategories(workspace),
});

export const definitionsHandler = defineApiHandlers(tagDefinitionsApiDoc.operations, {
  GET: ({ workspace }) => tags.listTagDefinitions(workspace),
  PUT: ({ workspace, body }) => tags.upsertTagDefinitions(workspace, body),
});
