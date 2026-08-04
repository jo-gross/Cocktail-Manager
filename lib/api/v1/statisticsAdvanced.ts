/**
 * v1 handler wiring for the bespoke advanced-analytics reads under
 * statistics/advanced/*. Each controller returns the FULL response payload
 * (including its custom `{ data, total }` / `{ data }` / `{ data, pagination }`
 * envelope); the handlers therefore write it verbatim to `res` and return
 * undefined so withValidation does not re-wrap it in a plain `{ data }` envelope.
 */
import {
  statisticsAdvancedCocktailItemApiDoc,
  statisticsAdvancedCocktailOrdersApiDoc,
  statisticsAdvancedCocktailsAllApiDoc,
  statisticsAdvancedCocktailsApiDoc,
  statisticsAdvancedCompareApiDoc,
  statisticsAdvancedIngredientsApiDoc,
  statisticsAdvancedOverviewApiDoc,
  statisticsAdvancedSetItemApiDoc,
  statisticsAdvancedSetsApiDoc,
  statisticsAdvancedTagsApiDoc,
} from '@lib/schemas/statisticsAdvanced';
import { defineApiHandlers } from '@lib/openapi/apiDoc';
import * as advanced from '@lib/api/controllers/statisticsAdvanced';

export const overviewHandler = defineApiHandlers(statisticsAdvancedOverviewApiDoc.operations, {
  GET: async ({ res, workspace, query }) => {
    res.status(200).json(await advanced.getOverview(workspace, query));
  },
});

export const cocktailsHandler = defineApiHandlers(statisticsAdvancedCocktailsApiDoc.operations, {
  GET: async ({ res, workspace, query }) => {
    res.status(200).json(await advanced.getCocktailRanking(workspace, query));
  },
});

export const cocktailsAllHandler = defineApiHandlers(statisticsAdvancedCocktailsAllApiDoc.operations, {
  GET: async ({ res, workspace, query }) => {
    res.status(200).json(await advanced.getCocktailsAll(workspace, query));
  },
});

export const cocktailItemHandler = defineApiHandlers(statisticsAdvancedCocktailItemApiDoc.operations, {
  GET: async ({ res, workspace, params, query }) => {
    res.status(200).json(await advanced.getCocktailDetail(workspace, params.cocktailId, query));
  },
});

export const cocktailOrdersHandler = defineApiHandlers(statisticsAdvancedCocktailOrdersApiDoc.operations, {
  GET: async ({ res, workspace, params, query }) => {
    res.status(200).json(await advanced.getCocktailOrders(workspace, params.cocktailId, query));
  },
});

export const ingredientsHandler = defineApiHandlers(statisticsAdvancedIngredientsApiDoc.operations, {
  GET: async ({ res, workspace, query }) => {
    res.status(200).json(await advanced.getIngredients(workspace, query));
  },
});

export const tagsHandler = defineApiHandlers(statisticsAdvancedTagsApiDoc.operations, {
  GET: async ({ res, workspace, query }) => {
    res.status(200).json(await advanced.getTags(workspace, query));
  },
});

export const compareHandler = defineApiHandlers(statisticsAdvancedCompareApiDoc.operations, {
  GET: async ({ res, workspace, query }) => {
    res.status(200).json(await advanced.compareSet(workspace, query));
  },
});

export const setsHandler = defineApiHandlers(statisticsAdvancedSetsApiDoc.operations, {
  GET: async ({ res, workspace, query }) => {
    res.status(200).json(await advanced.listSavedSets(workspace, query));
  },
  POST: async ({ res, workspace, body }) => {
    res.status(200).json(await advanced.createSavedSet(workspace, body));
  },
  PUT: async ({ res, workspace, body }) => {
    res.status(200).json(await advanced.updateSavedSet(workspace, body));
  },
  DELETE: async ({ res, workspace, query }) => {
    res.status(200).json(await advanced.deleteSavedSet(workspace, query.id));
  },
});

export const setItemHandler = defineApiHandlers(statisticsAdvancedSetItemApiDoc.operations, {
  GET: async ({ res, workspace, params, query }) => {
    res.status(200).json(await advanced.getSavedSetDetail(workspace, params.setId, query));
  },
});
