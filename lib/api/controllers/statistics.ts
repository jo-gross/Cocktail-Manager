/**
 * Version-agnostic business logic for cocktail statistics (v1, core endpoints).
 * Same DB operations as the legacy handlers, but returns clean public DTOs
 * (lib/api/dto/statistics.ts) plus PaginationMeta where paginated. Legacy routes
 * remain wrapped-but-untouched and keep their raw Prisma shapes.
 */
import prisma from '../../../prisma/prisma';
import { getEndOfDay, getStartOfDay } from '@lib/dateHelpers';
import { ApiError } from '@lib/http/ApiError';
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

export async function addCocktailStatistic(workspace: Workspace, user: User, input: CocktailStatisticCreateInput): Promise<CocktailStatisticItemDto> {
  const { cocktailId, cocktailCardId, actionSource, notes, ignoreQueue } = input;

  let cardId = cocktailCardId;
  if (cardId === 'search') {
    cardId = undefined;
  }

  const data: Prisma.CocktailStatisticItemCreateInput = {
    date: new Date(),
    workspace: { connect: { id: workspace.id } },
    user: { connect: { id: user.id } },
    cocktail: { connect: { id: cocktailId } },
    cocktailCard: cardId ? { connect: { id: cardId } } : undefined,
    actionSource: actionSource,
  };

  if (!ignoreQueue) {
    const items = await prisma.cocktailQueue.findMany({
      where: { workspaceId: workspace.id, cocktailId },
    });
    // If there are items in the queue, then some could be removed.
    if (items.length !== 0) {
      if (notes) {
        const searchNote: string | null = notes === '-' ? null : notes;
        const queueItem = await prisma.cocktailQueue.findFirst({
          where: { workspaceId: workspace.id, cocktailId, notes: searchNote },
          orderBy: { createdAt: 'asc' },
        });
        if (queueItem) {
          await prisma.cocktailQueue.delete({ where: { id: queueItem.id } });
        }
      } else {
        // Ask user which one to remove: list the oldest cocktail grouped by cocktailId and notes.
        const oldestEntries = await prisma.cocktailQueue.groupBy({
          by: ['cocktailId', 'notes'],
          where: { workspaceId: workspace.id, cocktailId },
          _min: { createdAt: true, id: true },
          orderBy: { _min: { createdAt: 'asc' } },
        });

        const notesEntry = oldestEntries.find((entry) => entry.notes != null);

        if (notesEntry == null && oldestEntries.length > 0 && oldestEntries[0]._min?.id != null) {
          await prisma.cocktailQueue.delete({ where: { id: oldestEntries[0]._min.id } });
        } else {
          throw new ApiError(400, 'STATISTIC_QUEUE_AMBIGUOUS', StatisticBadRequestMessage, oldestEntries);
        }
      }
    }
  }

  const created = await prisma.cocktailStatisticItem.create({ data, include: statisticItemInclude });
  return toCocktailStatisticItemDto(created);
}

export async function deleteCocktailStatistic(workspace: Workspace, cocktailStatisticId: string): Promise<{ count: number }> {
  const existing = await prisma.cocktailStatisticItem.findUnique({
    where: { id: cocktailStatisticId, workspaceId: workspace.id },
    select: { id: true },
  });
  if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Cocktail statistic not found');

  await prisma.cocktailStatisticItem.delete({
    where: { id: cocktailStatisticId, workspaceId: workspace.id },
  });

  return { count: 1 };
}
