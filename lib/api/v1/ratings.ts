/**
 * v1 handler wiring for ratings: validated, typed ctx → shared controllers
 * (which return clean DTOs).
 */
import { ratingsCollectionApiDoc, ratingsItemApiDoc } from '@lib/schemas/ratings';
import { defineApiHandlers } from '@lib/openapi/apiDoc';
import * as ratings from '@lib/api/controllers/ratings';

export const collectionHandler = defineApiHandlers(ratingsCollectionApiDoc.operations, {
  GET: ({ params }) => ratings.listRatings(params.cocktailId),
  POST: ({ params, body }) => ratings.createRating(params.cocktailId, body),
});

export const itemHandler = defineApiHandlers(ratingsItemApiDoc.operations, {
  DELETE: ({ workspace, params }) => ratings.deleteRating(workspace, params.ratingId),
});
