/**
 * Zod schemas + ResourceApiDocs for the Statistics resource (v1, core endpoints).
 * Pure module (zod + type-only enums) so scripts/generate-openapi.ts can import
 * it without pulling the Prisma runtime. Responses describe the clean public DTO
 * (see lib/api/dto/statistics.ts), NOT the raw Prisma shape.
 *
 * Scope: the core cocktail-statistic ("cocktails") and log ("logs") endpoints.
 * The bespoke analytics reads under statistics/advanced/* are intentionally NOT
 * included here and will be modelled separately.
 */
import { z } from '@lib/openapi/zod';
import { DateTimeString, WorkspaceIdParam, DeletionResult } from '@lib/schemas/common';
import { ApiTags } from '@lib/openapi/tags';
import type { ResourceApiDoc } from '@lib/openapi/types';

/** Slim embedded cocktail reference — just enough to identify/label the cocktail. */
export const StatisticCocktailRefSchema = z
  .object({
    id: z.string(),
    name: z.string(),
  })
  .openapi('StatisticCocktailRef');

/** Slim embedded cocktail-card reference, or null when the statistic has no card. */
export const StatisticCocktailCardRefSchema = z
  .object({
    id: z.string(),
    name: z.string(),
  })
  .openapi('StatisticCocktailCardRef');

/** Slim embedded user reference, or null when the user was removed. */
export const StatisticUserRefSchema = z
  .object({
    id: z.string(),
    name: z.string().nullable(),
  })
  .openapi('StatisticUser');

/**
 * Public cocktail-statistic DTO — ISO timestamps, no `workspaceId`/raw FKs,
 * relations flattened to slim `{ id, name }` refs.
 */
export const CocktailStatisticItemDtoSchema = z
  .object({
    id: z.string(),
    date: DateTimeString,
    actionSource: z.string().nullable().openapi({ description: 'Where the statistic entry originated (free-form source tag), or null.' }),
    cocktail: StatisticCocktailRefSchema,
    cocktailCard: StatisticCocktailCardRefSchema.nullable().openapi({ description: 'The cocktail card the drink was served from, or null.' }),
    user: StatisticUserRefSchema.nullable().openapi({ description: 'The user who logged the statistic, or null if the user was removed.' }),
  })
  .openapi('CocktailStatisticItem');

export type CocktailStatisticItemDto = z.infer<typeof CocktailStatisticItemDtoSchema>;

/** Body for logging a cocktail statistic entry (mirrors the legacy add endpoint). */
export const CocktailStatisticCreateSchema = z
  .object({
    cocktailId: z.string().min(1).max(100).openapi({ description: 'ID of the cocktail that was made.' }),
    cocktailCardId: z.string().max(100).optional().openapi({ description: 'ID of the cocktail card. The sentinel value `search` is treated as no card.' }),
    actionSource: z.string().max(100).optional().openapi({ description: 'Free-form origin tag for the statistic entry.' }),
    notes: z.string().max(500).optional().openapi({ description: 'Queue note to match when removing a queued cocktail (`-` matches an empty note).' }),
    ignoreQueue: z.boolean().optional().openapi({ description: 'When true, skips the cocktail-queue reconciliation.' }),
  })
  .openapi('CocktailStatisticCreateInput');

export type CocktailStatisticCreateInput = z.infer<typeof CocktailStatisticCreateSchema>;

/** Date query parameter (ISO date or timestamp); unparsable values are rejected with 400 instead of failing the query. */
export const StatisticDateQueryParam = z
  .string()
  .max(64)
  .refine((value) => !Number.isNaN(Date.parse(value)), { message: 'Invalid date' });

export const MAX_STATISTIC_PAGE_SIZE = 200;
export const MAX_STATISTIC_SEARCH_LENGTH = 200;

/** Query for the cocktail-statistics list (date-range filter, dayStartTime aware). */
export const CocktailStatisticListQuerySchema = z.object({
  startDate: StatisticDateQueryParam.optional().openapi({ description: 'Inclusive start date (interpreted with the workspace day-start-time setting).' }),
  endDate: StatisticDateQueryParam.optional().openapi({ description: 'Inclusive end date (interpreted with the workspace day-start-time setting).' }),
});

export type CocktailStatisticListQuery = z.infer<typeof CocktailStatisticListQuerySchema>;

/** Query for the paginated statistics log list. */
export const StatisticLogListQuerySchema = z.object({
  startDate: StatisticDateQueryParam.optional().openapi({ description: 'Inclusive start date (interpreted with the workspace day-start-time setting).' }),
  endDate: StatisticDateQueryParam.optional().openapi({ description: 'Inclusive end date (interpreted with the workspace day-start-time setting).' }),
  search: z.string().max(MAX_STATISTIC_SEARCH_LENGTH).optional().openapi({ description: 'Case-insensitive filter over cocktail, card and user name.' }),
  page: z.coerce.number().int().min(1).default(1).openapi({ description: '1-based page number.' }),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_STATISTIC_PAGE_SIZE)
    .default(50)
    .openapi({ description: `Items per page (at most ${MAX_STATISTIC_PAGE_SIZE}).` }),
});

export type StatisticLogListQuery = z.infer<typeof StatisticLogListQuerySchema>;

export const StatisticItemParams = WorkspaceIdParam.extend({ cocktailStatisticId: z.string() });

export const statisticsCocktailsCollectionApiDoc = {
  basePath: '/workspaces/{workspaceId}/statistics/cocktails',
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'STATISTICS_READ',
      tags: [ApiTags.statisticsLogging],
      summary: 'List cocktail statistics',
      description: 'List cocktail-statistic entries of a workspace, optionally filtered by a date range (day-start-time aware).',
      params: WorkspaceIdParam,
      query: CocktailStatisticListQuerySchema,
      response: z.array(CocktailStatisticItemDtoSchema),
    },
  },
} satisfies ResourceApiDoc;

export const statisticsCocktailsAddApiDoc = {
  basePath: '/workspaces/{workspaceId}/statistics/cocktails/add',
  operations: {
    POST: {
      roles: ['USER'],
      permission: 'STATISTICS_CREATE',
      tags: [ApiTags.statisticsLogging],
      summary: 'Log a cocktail statistic',
      description:
        'Records that a cocktail was made and reconciles the cocktail queue. ' +
        'Returns 400 when the queue contains ambiguous entries that require the caller to choose which one to remove.',
      params: WorkspaceIdParam,
      body: CocktailStatisticCreateSchema,
      response: CocktailStatisticItemDtoSchema,
      errorResponses: {
        400: 'Ambiguous cocktail-queue entries (specify a note to remove one), or the cocktail/card does not exist in this workspace.',
      },
    },
  },
} satisfies ResourceApiDoc;

export const statisticsCocktailsItemApiDoc = {
  basePath: '/workspaces/{workspaceId}/statistics/cocktails/{cocktailStatisticId}',
  operations: {
    DELETE: {
      roles: ['MANAGER'],
      permission: 'STATISTICS_DELETE',
      tags: [ApiTags.statisticsLogging],
      summary: 'Delete a cocktail statistic',
      params: StatisticItemParams,
      response: DeletionResult,
      errorResponses: { 404: 'Cocktail statistic not found.' },
    },
  },
} satisfies ResourceApiDoc;

export const statisticsLogsCollectionApiDoc = {
  basePath: '/workspaces/{workspaceId}/statistics/logs',
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'STATISTICS_READ',
      tags: [ApiTags.statisticsLogging],
      summary: 'List statistic logs',
      description:
        'List cocktail-statistic entries of a workspace, newest first, filtered by date range and/or name search. ' +
        'Paginated: the response is a `{ data, pagination }` envelope (not a bare array); `data` holds the `CocktailStatisticItem[]` page.',
      params: WorkspaceIdParam,
      query: StatisticLogListQuerySchema,
      response: z.array(CocktailStatisticItemDtoSchema),
    },
  },
} satisfies ResourceApiDoc;

export const statisticsLogsItemApiDoc = {
  basePath: '/workspaces/{workspaceId}/statistics/logs/{cocktailStatisticId}',
  operations: {
    DELETE: {
      roles: ['MANAGER'],
      permission: 'STATISTICS_DELETE',
      tags: [ApiTags.statisticsLogging],
      summary: 'Delete a statistic log',
      params: StatisticItemParams,
      response: DeletionResult,
      errorResponses: { 404: 'Cocktail statistic not found.' },
    },
  },
} satisfies ResourceApiDoc;
