/**
 * Zod schemas + ResourceApiDocs for the bespoke advanced-analytics reads under
 * statistics/advanced/*. Pure module (zod + type-only enums) so
 * scripts/generate-openapi.ts can import it without pulling the Prisma runtime.
 *
 * These endpoints compute free-form, chart-oriented aggregates whose response
 * shapes are large and heterogeneous. Per the API contract they are documented
 * with a GROUP of `.passthrough()` objects carrying field-level descriptions
 * (rather than exhaustive per-field modelling): the path, method, permission and
 * a rough response schema are authoritative; the aggregate values themselves are
 * replicated faithfully by the controllers (lib/api/controllers/statisticsAdvanced.ts).
 *
 * Prisma-ism cleanup applied by the controllers: no `_count`, camelCase keys,
 * slim cocktail refs where a cocktail is embedded. The computed KPIs are carried
 * over verbatim — no aggregates are re-invented.
 */
import { z } from '@lib/openapi/zod';
import { WorkspaceIdParam, DateTimeString, DeletionResult } from '@lib/schemas/common';
import { ApiTags } from '@lib/openapi/tags';
import type { ResourceApiDoc } from '@lib/openapi/types';

/** Optional inclusive date-range filter shared by most advanced reads (day-start-time aware). */
export const AdvancedDateRangeQuerySchema = z.object({
  startDate: z.string().optional().openapi({ description: 'Inclusive start date (interpreted with the workspace day-start-time setting).' }),
  endDate: z.string().optional().openapi({ description: 'Inclusive end date (interpreted with the workspace day-start-time setting).' }),
});

/** Slim cocktail reference embedded in advanced-analytics rows. */
export const AdvancedCocktailRefSchema = z.object({ id: z.string(), name: z.string() }).openapi('AdvancedStatisticsCocktailRef');

const passthrough = () => z.object({}).passthrough();

// ────────────── overview ──────────────

export const AdvancedOverviewResponseSchema = passthrough()
  .openapi({
    description:
      'Dashboard overview. `kpis` holds per-period KPI blocks (today/week/month/period/avgPerHour/allTime), each with totals, deltas vs. the previous period, top cocktail `{ name, count }` and revenue. `charts` holds per-period chart data (timeSeries `{ date, count }[]`, topCocktails `{ cocktailId, name, count }[]`, hourDistribution `{ hour, count }[]`). Legacy top-level `timeSeries`/`topCocktails`/`hourDistribution` mirror the `period` chart data.',
  })
  .openapi('AdvancedStatisticsOverview');

export const statisticsAdvancedOverviewApiDoc = {
  basePath: '/workspaces/{workspaceId}/statistics/advanced/overview',
  legacyPath: true,
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'STATISTICS_READ',
      tags: [ApiTags.statisticsAdvanced],
      summary: 'Advanced statistics overview',
      description:
        'Dashboard-style overview with per-period KPIs (today/week/month, a custom selected range, average-per-hour and all-time) plus their chart data. Defaults the selected range to the last 7 days when startDate/endDate are omitted.',
      params: WorkspaceIdParam,
      query: AdvancedDateRangeQuerySchema,
      response: AdvancedOverviewResponseSchema,
    },
  },
} satisfies ResourceApiDoc;

// ────────────── cocktails (ranking) ──────────────

export const AdvancedCocktailRankingRowSchema = passthrough()
  .openapi({
    description:
      'Per-cocktail ranking row: `cocktailId`, `name`, `tags`, `count`, `percentage` (share of period orders), `delta` (% vs. previous period), `previousCount`, `rank`, and `ingredients[]` (each with ingredientId/name/price, amount, unitId/name and availableUnits).',
  })
  .openapi('AdvancedStatisticsCocktailRankingRow');

export const AdvancedCocktailRankingResponseSchema = z
  .object({
    data: z.array(AdvancedCocktailRankingRowSchema),
    total: z.number().int().openapi({ description: 'Total number of orders in the selected period.' }),
  })
  .openapi('AdvancedStatisticsCocktailRanking');

export const statisticsAdvancedCocktailsApiDoc = {
  basePath: '/workspaces/{workspaceId}/statistics/advanced/cocktails',
  legacyPath: true,
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'STATISTICS_READ',
      tags: [ApiTags.statisticsAdvanced],
      summary: 'Advanced cocktail ranking',
      description:
        'Ranks cocktails by order count for the given date range, with share/delta vs. the previous equal-length period and each cocktail’s ingredient breakdown. Emits a `{ data, total }` envelope (not the standard `{ data }`). Requires startDate and endDate.',
      params: WorkspaceIdParam,
      query: AdvancedDateRangeQuerySchema,
      response: AdvancedCocktailRankingResponseSchema,
      errorResponses: { 400: 'startDate and endDate are required.' },
    },
  },
} satisfies ResourceApiDoc;

// ────────────── cocktails/all ──────────────

export const AdvancedCocktailAllRowSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    count: z.number().int().openapi({ description: 'Order count in the period (0 when no date range or no orders).' }),
  })
  .openapi('AdvancedStatisticsCocktailAllRow');

export const AdvancedCocktailAllResponseSchema = z
  .object({
    data: z.array(AdvancedCocktailAllRowSchema),
    total: z.number().int().openapi({ description: 'Total number of orders in the period across all cocktails.' }),
  })
  .openapi('AdvancedStatisticsCocktailAll');

export const statisticsAdvancedCocktailsAllApiDoc = {
  basePath: '/workspaces/{workspaceId}/statistics/advanced/cocktails/all',
  legacyPath: true,
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'STATISTICS_READ',
      tags: [ApiTags.statisticsAdvanced],
      summary: 'All cocktails with order counts',
      description:
        'Lists every cocktail in the workspace (name-ordered) with its order count for the given range; cocktails without orders are included with count 0. Order counts are only computed when both startDate and endDate are supplied. Emits a `{ data, total }` envelope.',
      params: WorkspaceIdParam,
      query: AdvancedDateRangeQuerySchema,
      response: AdvancedCocktailAllResponseSchema,
    },
  },
} satisfies ResourceApiDoc;

// ────────────── cocktails/{cocktailId} ──────────────

export const CocktailIdParam = WorkspaceIdParam.extend({ cocktailId: z.string() });

export const AdvancedCocktailDetailResponseSchema = z
  .object({
    data: passthrough().openapi({
      description:
        'Single-cocktail analytics: `cocktail` `{ id, name, tags, price }`, `total`, `avgPerActiveHour`, `rank`, `delta` (% vs. previous period), `previousTotal`, `revenue`, `previousRevenue`, `timeSeries` `{ date, count }[]` (granularity auto-chosen by range), `hourDistribution` `{ hour, count }[]` (0–23), `dayDistribution` `{ day, count }[]` (0=Sun…6), and `ingredients` (ingredient name list). All-time range is used when startDate/endDate are omitted.',
    }),
  })
  .openapi('AdvancedStatisticsCocktailDetail');

export const statisticsAdvancedCocktailItemApiDoc = {
  basePath: '/workspaces/{workspaceId}/statistics/advanced/cocktails/{cocktailId}',
  legacyPath: true,
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'STATISTICS_READ',
      tags: [ApiTags.statisticsAdvanced],
      summary: 'Advanced single-cocktail analytics',
      description:
        'Deep-dive analytics for one cocktail: totals, rank, deltas, revenue, time series and hour/day distributions. Emits a `{ data }` envelope. Uses the cocktail’s full order history when no date range is given.',
      params: CocktailIdParam,
      query: AdvancedDateRangeQuerySchema,
      response: AdvancedCocktailDetailResponseSchema,
      errorResponses: { 404: 'Cocktail not found.' },
    },
  },
} satisfies ResourceApiDoc;

// ────────────── cocktails/{cocktailId}/orders ──────────────

export const AdvancedCocktailOrdersQuerySchema = z.object({
  startDate: z.string().optional().openapi({ description: 'Inclusive start date (day-start-time aware).' }),
  endDate: z.string().optional().openapi({ description: 'Inclusive end date (day-start-time aware).' }),
  search: z.string().optional().openapi({ description: 'Case-insensitive filter over formatted date, weekday, user (name/email) and card name.' }),
  page: z.string().optional().openapi({ description: '1-based page number (default 1).' }),
  limit: z.string().optional().openapi({ description: 'Items per page (default 50).' }),
});

/** Slim user reference embedded in an order row. */
export const AdvancedOrderUserSchema = z.object({ name: z.string().nullable(), email: z.string().nullable() }).openapi('AdvancedStatisticsOrderUser');

/** Slim card reference embedded in an order row. */
export const AdvancedOrderCardSchema = z.object({ name: z.string() }).openapi('AdvancedStatisticsOrderCard');

export const AdvancedCocktailOrderRowSchema = z
  .object({
    id: z.string(),
    date: DateTimeString,
    user: AdvancedOrderUserSchema.nullable(),
    cocktailCard: AdvancedOrderCardSchema.nullable(),
  })
  .openapi('AdvancedStatisticsCocktailOrderRow');

export const AdvancedCocktailOrdersResponseSchema = z
  .object({
    data: z.array(AdvancedCocktailOrderRowSchema),
    pagination: z
      .object({
        page: z.number().int(),
        limit: z.number().int(),
        total: z.number().int(),
        totalPages: z.number().int(),
      })
      .openapi({ description: 'Legacy pagination block (page/limit/total/totalPages), distinct from the standard PaginationMeta.' }),
  })
  .openapi('AdvancedStatisticsCocktailOrders');

export const statisticsAdvancedCocktailOrdersApiDoc = {
  basePath: '/workspaces/{workspaceId}/statistics/advanced/cocktails/{cocktailId}/orders',
  legacyPath: true,
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'STATISTICS_READ',
      tags: [ApiTags.statisticsAdvanced],
      summary: 'Paginated order log for a cocktail',
      description:
        'Newest-first, searchable, paginated list of individual orders (statistic entries) for one cocktail. Search filters over formatted date/weekday, user and card. Emits a `{ data, pagination }` envelope with the legacy pagination block.',
      params: CocktailIdParam,
      query: AdvancedCocktailOrdersQuerySchema,
      response: AdvancedCocktailOrdersResponseSchema,
      errorResponses: { 404: 'Cocktail not found.' },
    },
  },
} satisfies ResourceApiDoc;

// ────────────── ingredients ──────────────

export const AdvancedIngredientRowSchema = z
  .object({
    ingredient: z.string().openapi({ description: 'Ingredient name.' }),
    count: z.number().int().openapi({ description: 'Number of orders whose cocktail uses this ingredient.' }),
    cocktailCount: z.number().int().openapi({ description: 'Number of distinct cocktails that use this ingredient.' }),
    percentage: z.number().openapi({ description: 'Share of period orders using this ingredient (%).' }),
  })
  .openapi('AdvancedStatisticsIngredientRow');

export const AdvancedIngredientsResponseSchema = z
  .object({
    data: z.array(AdvancedIngredientRowSchema),
    total: z.number().int().openapi({ description: 'Total number of orders in the period.' }),
  })
  .openapi('AdvancedStatisticsIngredients');

export const statisticsAdvancedIngredientsApiDoc = {
  basePath: '/workspaces/{workspaceId}/statistics/advanced/ingredients',
  legacyPath: true,
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'STATISTICS_READ',
      tags: [ApiTags.statisticsAdvanced],
      summary: 'Ingredient usage statistics',
      description:
        'Lists every ingredient with its order-usage count, the number of distinct cocktails using it, and its share of period orders. Counts are only computed when both startDate and endDate are supplied. Emits a `{ data, total }` envelope.',
      params: WorkspaceIdParam,
      query: AdvancedDateRangeQuerySchema,
      response: AdvancedIngredientsResponseSchema,
    },
  },
} satisfies ResourceApiDoc;

// ────────────── tags ──────────────

export const AdvancedTagRowSchema = z
  .object({
    tag: z.string(),
    count: z.number().int().openapi({ description: 'Number of orders whose cocktail carries this tag.' }),
    cocktailCount: z.number().int().openapi({ description: 'Number of distinct cocktails carrying this tag.' }),
    percentage: z.number().openapi({ description: 'Share of period orders carrying this tag (%).' }),
  })
  .openapi('AdvancedStatisticsTagRow');

export const AdvancedTagsResponseSchema = z
  .object({
    data: z.array(AdvancedTagRowSchema),
    total: z.number().int().openapi({ description: 'Total number of orders in the period.' }),
  })
  .openapi('AdvancedStatisticsTags');

export const statisticsAdvancedTagsApiDoc = {
  basePath: '/workspaces/{workspaceId}/statistics/advanced/tags',
  legacyPath: true,
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'STATISTICS_READ',
      tags: [ApiTags.statisticsAdvanced],
      summary: 'Tag usage statistics',
      description:
        'Lists every tag with its order-usage count, the number of distinct cocktails carrying it, and its share of period orders. Counts are only computed when both startDate and endDate are supplied. Emits a `{ data, total }` envelope.',
      params: WorkspaceIdParam,
      query: AdvancedDateRangeQuerySchema,
      response: AdvancedTagsResponseSchema,
    },
  },
} satisfies ResourceApiDoc;

// ────────────── compare ──────────────

export const AdvancedCompareQuerySchema = z.object({
  type: z.enum(['TAG_SET', 'INGREDIENT_SET']).openapi({ description: 'What the items represent.' }),
  items: z.string().openapi({ description: 'JSON-encoded array of tag/ingredient names (a bare string is treated as a single item).' }),
  logic: z.enum(['AND', 'OR']).optional().openapi({ description: 'Match logic across items (default AND).' }),
  startDate: z.string().optional().openapi({ description: 'Inclusive start date (day-start-time aware); all-time when omitted.' }),
  endDate: z.string().optional().openapi({ description: 'Inclusive end date (day-start-time aware); all-time when omitted.' }),
});

export const AdvancedCompareResponseSchema = z
  .object({
    data: passthrough().openapi({
      description:
        'Ad-hoc set comparison: `set` `{ name, type, logic }`, `kpis` (total, percentage, cocktailCount, totalStats, totalUniqueCocktailsInPeriod, cocktailPercentage, totalCocktailsInWorkspace, cocktailPercentageAll, revenue, totalRevenue), `cocktails` `{ cocktailId, name, count }[]`, and `aggregated` `{ name, count }[]` (ingredients for TAG_SET, tags for INGREDIENT_SET).',
    }),
  })
  .openapi('AdvancedStatisticsCompare');

export const statisticsAdvancedCompareApiDoc = {
  basePath: '/workspaces/{workspaceId}/statistics/advanced/compare',
  legacyPath: true,
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'STATISTICS_READ',
      tags: [ApiTags.statisticsAdvanced],
      summary: 'Compare an ad-hoc tag/ingredient set',
      description:
        'Computes KPIs, matching cocktails and a cross-aggregate for an ad-hoc tag or ingredient set (with AND/OR logic). Emits a `{ data }` envelope. Uses all-time when no date range is given.',
      params: WorkspaceIdParam,
      query: AdvancedCompareQuerySchema,
      response: AdvancedCompareResponseSchema,
      errorResponses: { 400: 'type and items are required.' },
    },
  },
} satisfies ResourceApiDoc;

// ────────────── sets (collection) ──────────────

export const SavedSetItemSchema = passthrough()
  .openapi({
    description: 'A saved statistics set (id, workspaceId, name, type, logic, items[], createdAt, updatedAt).',
  })
  .openapi('AdvancedStatisticsSavedSet');

export const AdvancedSetsListQuerySchema = z.object({
  type: z.string().optional().openapi({ description: 'Filter by a single SavedSetType.' }),
  types: z.string().optional().openapi({ description: 'Comma-separated list of SavedSetTypes to filter by (ignored when `type` is set).' }),
});

export const AdvancedSetCreateSchema = z
  .object({
    name: z.string().openapi({ description: 'Set name.' }),
    type: z.string().openapi({ description: 'SavedSetType (COCKTAIL_SET | TAG_SET | INGREDIENT_SET).' }),
    logic: z.string().nullish().openapi({ description: 'SavedSetLogic (AND | OR), or null.' }),
    items: z.array(z.string()).openapi({ description: 'Member names/ids for the set.' }),
  })
  .openapi('AdvancedStatisticsSavedSetCreateInput');

export const AdvancedSetUpdateSchema = z
  .object({
    id: z.string().openapi({ description: 'Id of the set to update.' }),
    name: z.string().optional().openapi({ description: 'New name (optional).' }),
    logic: z.string().nullish().openapi({ description: 'New logic (AND | OR) or null (optional).' }),
    items: z.array(z.string()).optional().openapi({ description: 'New member list (optional).' }),
  })
  .openapi('AdvancedStatisticsSavedSetUpdateInput');

export const AdvancedSetDeleteQuerySchema = z.object({
  id: z.string().openapi({ description: 'Id of the set to delete.' }),
});

export const statisticsAdvancedSetsApiDoc = {
  basePath: '/workspaces/{workspaceId}/statistics/advanced/sets',
  legacyPath: true,
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'STATISTICS_READ',
      tags: [ApiTags.statisticsAdvanced],
      summary: 'List saved statistics sets',
      description: 'Lists saved statistics sets of a workspace (newest first), optionally filtered by type/types. Emits a `{ data }` envelope.',
      params: WorkspaceIdParam,
      query: AdvancedSetsListQuerySchema,
      response: z.array(SavedSetItemSchema),
    },
    POST: {
      roles: ['USER'],
      permission: 'STATISTICS_READ',
      tags: [ApiTags.statisticsAdvanced],
      summary: 'Create a saved statistics set',
      params: WorkspaceIdParam,
      body: AdvancedSetCreateSchema,
      response: SavedSetItemSchema,
      errorResponses: { 400: 'Missing required fields, or invalid type/logic.' },
    },
    PUT: {
      roles: ['USER'],
      permission: 'STATISTICS_READ',
      tags: [ApiTags.statisticsAdvanced],
      summary: 'Update a saved statistics set',
      params: WorkspaceIdParam,
      body: AdvancedSetUpdateSchema,
      response: SavedSetItemSchema,
      errorResponses: { 400: 'id is required.', 404: 'Set not found.' },
    },
    DELETE: {
      roles: ['USER'],
      permission: 'STATISTICS_READ',
      tags: [ApiTags.statisticsAdvanced],
      summary: 'Delete a saved statistics set',
      params: WorkspaceIdParam,
      query: AdvancedSetDeleteQuerySchema,
      response: DeletionResult,
      errorResponses: { 400: 'id is required.', 404: 'Set not found.' },
    },
  },
} satisfies ResourceApiDoc;

// ────────────── sets/{setId} ──────────────

export const SetIdParam = WorkspaceIdParam.extend({ setId: z.string() });

export const AdvancedSetDetailResponseSchema = z
  .object({
    data: passthrough().openapi({
      description:
        'Analytics for a saved set: `set` `{ id, name, type, logic, items }`, `kpis` (total, percentage, cocktailCount, totalStats, totalUniqueCocktailsInPeriod, cocktailPercentage, totalCocktailsInWorkspace, cocktailPercentageAll), `cocktails` `{ cocktailId, name, count }[]`, and `aggregated` `{ name, count }[]` (ingredients for TAG_SET, tags for INGREDIENT_SET).',
    }),
  })
  .openapi('AdvancedStatisticsSetDetail');

export const statisticsAdvancedSetItemApiDoc = {
  basePath: '/workspaces/{workspaceId}/statistics/advanced/sets/{setId}',
  legacyPath: true,
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'STATISTICS_READ',
      tags: [ApiTags.statisticsAdvanced],
      summary: 'Analytics for a saved set',
      description:
        'Resolves a saved set to its matching cocktails and computes KPIs, per-cocktail counts and a cross-aggregate. Emits a `{ data }` envelope. Uses all-time when no date range is given.',
      params: SetIdParam,
      query: AdvancedDateRangeQuerySchema,
      response: AdvancedSetDetailResponseSchema,
      errorResponses: { 404: 'Set not found.' },
    },
  },
} satisfies ResourceApiDoc;
