/**
 * Version-agnostic business logic for cocktail statistics (v1, core endpoints).
 * Returns clean public DTOs (lib/api/dto/statistics.ts) plus PaginationMeta
 * where paginated. Every path/body id is scoped to the caller's workspace.
 */
import prisma from '../../../prisma/prisma';
import { getEndOfDay, getStartOfDay } from '@lib/dateHelpers';
import { ApiError } from '@lib/http/ApiError';
import { actorUserId } from '@lib/http/requestAuth';
import { assertIdsInWorkspace } from '@lib/api/scope';
import { runTx } from '@lib/db/tx';
import { consumeOldestQueueItem } from '@lib/api/controllers/queue';
import { StatisticBadRequestMessage } from '../../../models/StatisticBadRequest';
import { toCocktailStatisticItemDto } from '@lib/api/dto/statistics';
import { Prisma, WorkspaceSettingKey } from '@generated/prisma/client';
import type { User, Workspace } from '@generated/prisma/client';
import type { CocktailStatisticCreateInput, CocktailStatisticItemDto } from '@lib/schemas/statistics';
import type { PaginationMeta } from '@lib/http/responses';

/** Slim relation include for the statistic-item DTO. */
const statisticItemInclude = {
  cocktail: { select: { id: true, name: true } },
  cocktailCard: { select: { id: true, name: true } },
  user: { select: { id: true, name: true } },
} satisfies Prisma.CocktailStatisticItemInclude;

/** Reads the workspace statisticDayStartTime setting (used to bound date filters). */
async function getDayStartTime(workspaceId: string): Promise<string | undefined> {
  const setting = await prisma.workspaceSetting.findUnique({
    where: {
      workspaceId_setting: { workspaceId, setting: WorkspaceSettingKey.statisticDayStartTime },
    },
  });
  return setting?.value || undefined;
}

function buildDateWhere(startDate: string | undefined, endDate: string | undefined, dayStartTime: string | undefined): Prisma.DateTimeFilter | undefined {
  if (!startDate && !endDate) return undefined;
  const dateFilter: Prisma.DateTimeFilter = {};
  if (startDate) dateFilter.gte = getStartOfDay(new Date(startDate), dayStartTime);
  if (endDate) dateFilter.lte = getEndOfDay(new Date(endDate), dayStartTime);
  return dateFilter;
}

export async function listCocktailStatistics(workspace: Workspace, opts: { startDate?: string; endDate?: string }): Promise<CocktailStatisticItemDto[]> {
  const dayStartTime = await getDayStartTime(workspace.id);

  const where: Prisma.CocktailStatisticItemWhereInput = { workspaceId: workspace.id };
  const dateFilter = buildDateWhere(opts.startDate, opts.endDate, dayStartTime);
  if (dateFilter) where.date = dateFilter;

  const items = await prisma.cocktailStatisticItem.findMany({ where, include: statisticItemInclude });
  return items.map(toCocktailStatisticItemDto);
}

export async function listStatisticLogs(
  workspace: Workspace,
  opts: { startDate?: string; endDate?: string; search?: string; page: number; limit: number },
): Promise<{ items: CocktailStatisticItemDto[]; pagination: PaginationMeta }> {
  const dayStartTime = await getDayStartTime(workspace.id);

  const where: Prisma.CocktailStatisticItemWhereInput = { workspaceId: workspace.id };
  const dateFilter = buildDateWhere(opts.startDate, opts.endDate, dayStartTime);
  if (dateFilter) where.date = dateFilter;

  const searchTerm = opts.search ? opts.search.trim().toLowerCase() : null;
  if (searchTerm) {
    where.OR = [
      { cocktail: { name: { contains: searchTerm, mode: 'insensitive' } } },
      { cocktailCard: { name: { contains: searchTerm, mode: 'insensitive' } } },
      { user: { name: { contains: searchTerm, mode: 'insensitive' } } },
    ];
  }

  const skip = (opts.page - 1) * opts.limit;

  const [total, logs] = await Promise.all([
    prisma.cocktailStatisticItem.count({ where }),
    prisma.cocktailStatisticItem.findMany({
      where,
      include: statisticItemInclude,
      orderBy: { date: 'desc' },
      take: opts.limit,
      skip,
    }),
  ]);

  const items = logs.map(toCocktailStatisticItemDto);

  return {
    items,
    pagination: {
      total,
      list_total: items.length,
      page: opts.page,
      totalPages: Math.ceil(total / opts.limit),
    },
  };
}

/**
 * Records that a cocktail was made and, unless `ignoreQueue`, consumes the
 * matching queue item. Both happen in one transaction; the queue item is taken
 * with `SKIP LOCKED`, so two bartenders finishing the same cocktail each consume
 * a different item (or none when the queue ran empty) instead of failing.
 */
export async function addCocktailStatistic(workspace: Workspace, user: User, input: CocktailStatisticCreateInput): Promise<CocktailStatisticItemDto> {
  const { cocktailId, actionSource, notes, ignoreQueue } = input;
  const cardId = input.cocktailCardId && input.cocktailCardId !== 'search' ? input.cocktailCardId : null;

  const created = await runTx(async (tx) => {
    await assertIdsInWorkspace(tx, workspace.id, { cocktail: [cocktailId], card: [cardId] });

    if (!ignoreQueue) {
      if (notes) {
        await consumeOldestQueueItem(tx, workspace.id, cocktailId, notes === '-' ? null : notes);
      } else {
        // Without notes only un-noted items may be consumed; if noted ones exist the caller must choose.
        const oldestEntries = await tx.cocktailQueue.groupBy({
          by: ['cocktailId', 'notes'],
          where: { workspaceId: workspace.id, cocktailId },
          _min: { createdAt: true, id: true },
          orderBy: { _min: { createdAt: 'asc' } },
        });
        if (oldestEntries.some((entry) => entry.notes != null)) {
          throw new ApiError(400, 'STATISTIC_QUEUE_AMBIGUOUS', StatisticBadRequestMessage, oldestEntries);
        }
        if (oldestEntries.length > 0) {
          await consumeOldestQueueItem(tx, workspace.id, cocktailId, null);
        }
      }
    }

    return tx.cocktailStatisticItem.create({
      data: {
        date: new Date(),
        workspaceId: workspace.id,
        userId: actorUserId(user.id),
        cocktailId,
        cocktailCardId: cardId,
        actionSource,
      },
      include: statisticItemInclude,
    });
  });

  return toCocktailStatisticItemDto(created);
}

export async function deleteCocktailStatistic(workspace: Workspace, cocktailStatisticId: string): Promise<{ count: number }> {
  const { count } = await prisma.cocktailStatisticItem.deleteMany({
    where: { id: cocktailStatisticId, workspaceId: workspace.id },
  });
  if (count === 0) throw new ApiError(404, 'NOT_FOUND', 'Cocktail statistic not found');

  return { count };
}
