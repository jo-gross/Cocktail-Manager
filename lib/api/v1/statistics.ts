/**
 * v1 handler wiring for cocktail statistics (core endpoints): validated, typed
 * ctx → shared controllers (which return clean DTOs). The logs list is paginated
 * and therefore emits a `{ data, pagination }` envelope itself (defineApiHandlers/
 * withValidation would otherwise wrap the return value in a plain `{ data }`
 * envelope), returning undefined so withValidation skips re-sending.
 *
 * The cocktails-item and logs-item DELETE endpoints share identical behaviour
 * (delete a CocktailStatisticItem by id) and reuse the same controller.
 */
import { paginated } from '@lib/http/responses';
import {
  statisticsCocktailsAddApiDoc,
  statisticsCocktailsCollectionApiDoc,
  statisticsCocktailsItemApiDoc,
  statisticsLogsCollectionApiDoc,
  statisticsLogsItemApiDoc,
} from '@lib/schemas/statistics';
import { defineApiHandlers } from '@lib/openapi/apiDoc';
import * as statistics from '@lib/api/controllers/statistics';

export const cocktailsCollectionHandler = defineApiHandlers(statisticsCocktailsCollectionApiDoc.operations, {
  GET: ({ workspace, query }) => statistics.listCocktailStatistics(workspace, query),
});

export const cocktailsAddHandler = defineApiHandlers(statisticsCocktailsAddApiDoc.operations, {
  POST: ({ workspace, user, body }) => statistics.addCocktailStatistic(workspace, user, body),
});

export const cocktailsItemHandler = defineApiHandlers(statisticsCocktailsItemApiDoc.operations, {
  DELETE: ({ workspace, params }) => statistics.deleteCocktailStatistic(workspace, params.cocktailStatisticId),
});

export const logsCollectionHandler = defineApiHandlers(statisticsLogsCollectionApiDoc.operations, {
  GET: async ({ res, workspace, query }) => {
    const { items, pagination } = await statistics.listStatisticLogs(workspace, query);
    res.status(200).json(paginated(items, pagination));
  },
});

export const logsItemHandler = defineApiHandlers(statisticsLogsItemApiDoc.operations, {
  DELETE: ({ workspace, params }) => statistics.deleteCocktailStatistic(workspace, params.cocktailStatisticId),
});
