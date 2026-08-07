/**
 * Version-agnostic business logic for the bespoke advanced-analytics reads under
 * statistics/advanced/*. These faithfully replicate the legacy handlers'
 * computations; the returned objects are the FULL response payloads (including
 * their `{ data, total }` / `{ data }` / `{ data, pagination }` envelopes) and
 * are written verbatim by the v1 handlers (lib/api/v1/statisticsAdvanced.ts) so
 * the wire shape matches the legacy endpoints exactly.
 *
 * Only obvious Prisma-isms are cleaned up (no `_count` leaks, camelCase, slim
 * cocktail refs) — none of the computed aggregates are re-invented.
 */
import prisma from '../../../prisma/prisma';
import { ApiError } from '@lib/http/ApiError';
import { Prisma, SavedSetLogic, SavedSetType, WorkspaceSettingKey } from '@generated/prisma/client';
import { formatDateLocal, getEndOfDay, getLogicalDate, getStartOfDay, getStartOfMonth, getStartOfWeek } from '@lib/dateHelpers';
import type { Workspace } from '@generated/prisma/client';

/** Reads the workspace statisticDayStartTime setting (used to bound date filters). */
async function getDayStartTime(workspaceId: string): Promise<string | undefined> {
  const setting = await prisma.workspaceSetting.findUnique({
    where: { workspaceId_setting: { workspaceId, setting: WorkspaceSettingKey.statisticDayStartTime } },
  });
  return setting?.value || undefined;
}

// ────────────── overview ──────────────

async function getStatisticsForPeriod(workspaceId: string, startDate: Date, endDate: Date, dayStartTime?: string) {
  const stats = await prisma.cocktailStatisticItem.findMany({
    where: { workspaceId, date: { gte: startDate, lte: endDate } },
    include: { cocktail: { select: { id: true, name: true, price: true } } },
  });

  const total = stats.length;
  const hours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
  const avgPerHour = hours > 0 ? total / hours : 0;

  const hourCounts: Record<number, number> = {};
  stats.forEach((stat) => {
    const hour = new Date(stat.date).getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  });

  let peakHour = 0;
  let peakCount = 0;
  Object.entries(hourCounts).forEach(([hour, count]) => {
    if (count > peakCount) {
      peakCount = count;
      peakHour = parseInt(hour);
    }
  });

  const dayCounts: Record<number, number> = {};
  stats.forEach((stat) => {
    const logicalDate = getLogicalDate(new Date(stat.date), dayStartTime);
    const day = logicalDate.getDay();
    dayCounts[day] = (dayCounts[day] || 0) + 1;
  });

  let peakDay = 0;
  let peakDayCount = 0;
  Object.entries(dayCounts).forEach(([day, count]) => {
    if (count > peakDayCount) {
      peakDayCount = count;
      peakDay = parseInt(day);
    }
  });

  const cocktailCounts: Record<string, { count: number; name: string; price: number }> = {};
  stats.forEach((stat) => {
    const cocktailId = stat.cocktailId;
    if (!cocktailCounts[cocktailId]) {
      cocktailCounts[cocktailId] = { count: 0, name: stat.cocktail?.name || 'Unknown', price: stat.cocktail?.price || 0 };
    }
    cocktailCounts[cocktailId].count++;
  });

  let topCocktail: { name: string; count: number } | null = null;
  let topCount = 0;
  Object.values(cocktailCounts).forEach((cocktail) => {
    if (cocktail.count > topCount) {
      topCount = cocktail.count;
      topCocktail = { name: cocktail.name, count: cocktail.count };
    }
  });

  let revenue = 0;
  stats.forEach((stat) => {
    revenue += stat.cocktail?.price || 0;
  });

  return { total, avgPerHour, peakHour, peakDay, topCocktail, revenue };
}

async function getChartDataForPeriod(workspaceId: string, startDate: Date, endDate: Date, dayStartTime?: string) {
  const stats = await prisma.cocktailStatisticItem.findMany({
    where: { workspaceId, date: { gte: startDate, lte: endDate } },
    orderBy: { date: 'asc' },
  });

  const dayGroups: Record<string, number> = {};
  stats.forEach((stat) => {
    const logicalDate = getLogicalDate(new Date(stat.date), dayStartTime);
    const dateKey = formatDateLocal(logicalDate);
    dayGroups[dateKey] = (dayGroups[dateKey] || 0) + 1;
  });

  const timeSeries = Object.entries(dayGroups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  const topCocktails = await prisma.cocktailStatisticItem.groupBy({
    by: ['cocktailId'],
    where: { workspaceId, date: { gte: startDate, lte: endDate } },
    _count: { cocktailId: true },
    orderBy: { _count: { cocktailId: 'desc' } },
    take: 10,
  });

  const topCocktailsWithNames = await Promise.all(
    topCocktails.map(async (item) => {
      const cocktail = await prisma.cocktailRecipe.findUnique({ where: { id: item.cocktailId }, select: { name: true } });
      return { cocktailId: item.cocktailId, name: cocktail?.name || 'Unknown', count: item._count.cocktailId };
    }),
  );

  const hourDistribution: Record<number, number> = {};
  stats.forEach((stat) => {
    const hour = new Date(stat.date).getHours();
    hourDistribution[hour] = (hourDistribution[hour] || 0) + 1;
  });

  const hourDistributionArray = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: hourDistribution[i] || 0 }));

  return { timeSeries, topCocktails: topCocktailsWithNames, hourDistribution: hourDistributionArray };
}

export async function getOverview(workspace: Workspace, opts: { startDate?: string; endDate?: string }): Promise<unknown> {
  const now = new Date();
  const dayStartTime = await getDayStartTime(workspace.id);

  const customStartDate = opts.startDate;
  const customEndDate = opts.endDate;

  let selectedStartDate: Date;
  let selectedEndDate: Date;

  if (customStartDate && customEndDate) {
    selectedStartDate = new Date(customStartDate);
    selectedEndDate = new Date(customEndDate);
    selectedStartDate = getStartOfDay(selectedStartDate, dayStartTime);
    selectedEndDate = getEndOfDay(selectedEndDate, dayStartTime);
  } else {
    selectedStartDate = new Date(now);
    selectedStartDate.setDate(selectedStartDate.getDate() - 7);
    selectedStartDate = getStartOfDay(selectedStartDate, dayStartTime);
    selectedEndDate = getEndOfDay(now, dayStartTime);
  }

  const todayStart = getStartOfDay(now, dayStartTime);
  const todayEnd = getEndOfDay(now, dayStartTime);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const yesterdayEnd = new Date(todayEnd);
  yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);

  const weekStart = getStartOfWeek(now, dayStartTime);
  const weekEnd = getEndOfDay(now, dayStartTime);
  const lastWeekStart = new Date(weekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(weekStart);
  lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);
  const lastWeekStartAdjusted = getStartOfDay(lastWeekStart, dayStartTime);
  const lastWeekEndAdjusted = getEndOfDay(lastWeekEnd, dayStartTime);

  const monthStart = getStartOfMonth(now, dayStartTime);
  const monthEnd = getEndOfDay(now, dayStartTime);
  const lastMonthStart = new Date(monthStart);
  lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
  const lastMonthEnd = new Date(monthStart);
  lastMonthEnd.setDate(0);
  const lastMonthStartAdjusted = getStartOfDay(lastMonthStart, dayStartTime);
  const lastMonthEndAdjusted = getEndOfDay(lastMonthEnd, dayStartTime);

  const todayStats = await getStatisticsForPeriod(workspace.id, todayStart, todayEnd, dayStartTime);
  const weekStats = await getStatisticsForPeriod(workspace.id, weekStart, weekEnd, dayStartTime);
  const monthStats = await getStatisticsForPeriod(workspace.id, monthStart, monthEnd, dayStartTime);

  const yesterdayStats = await getStatisticsForPeriod(workspace.id, yesterdayStart, yesterdayEnd, dayStartTime);
  const lastWeekStats = await getStatisticsForPeriod(workspace.id, lastWeekStartAdjusted, lastWeekEndAdjusted, dayStartTime);
  const lastMonthStats = await getStatisticsForPeriod(workspace.id, lastMonthStartAdjusted, lastMonthEndAdjusted, dayStartTime);

  const firstStat = await prisma.cocktailStatisticItem.findFirst({ where: { workspaceId: workspace.id }, orderBy: { date: 'asc' } });

  let allTimeStats: { total: number; avgPerDay: number; daysActive: number; topCocktail: { name: string; count: number } | null; revenue: number } = {
    total: 0,
    avgPerDay: 0,
    daysActive: 0,
    topCocktail: null,
    revenue: 0,
  };
  if (firstStat) {
    const allTimeStart = getStartOfDay(firstStat.date, dayStartTime);
    const allTimeEnd = getEndOfDay(now, dayStartTime);
    const allTimeData = await getStatisticsForPeriod(workspace.id, allTimeStart, allTimeEnd, dayStartTime);
    const daysActive = Math.ceil((allTimeEnd.getTime() - allTimeStart.getTime()) / (1000 * 60 * 60 * 24));
    allTimeStats = {
      total: allTimeData.total,
      avgPerDay: daysActive > 0 ? allTimeData.total / daysActive : 0,
      daysActive,
      topCocktail: allTimeData.topCocktail,
      revenue: allTimeData.revenue,
    };
  }

  const periodStats = await prisma.cocktailStatisticItem.findMany({
    where: { workspaceId: workspace.id, date: { gte: selectedStartDate, lte: selectedEndDate } },
    include: { cocktail: { select: { price: true } } },
  });
  const periodRevenue = periodStats.reduce((sum, stat) => sum + (stat.cocktail?.price || 0), 0);
  const periodTotal = periodStats.length;

  const todayDelta = yesterdayStats.total > 0 ? ((todayStats.total - yesterdayStats.total) / yesterdayStats.total) * 100 : 0;
  const weekDelta = lastWeekStats.total > 0 ? ((weekStats.total - lastWeekStats.total) / lastWeekStats.total) * 100 : 0;
  const monthDelta = lastMonthStats.total > 0 ? ((monthStats.total - lastMonthStats.total) / lastMonthStats.total) * 100 : 0;
  const avgPerHourDelta = yesterdayStats.avgPerHour > 0 ? ((todayStats.avgPerHour - yesterdayStats.avgPerHour) / yesterdayStats.avgPerHour) * 100 : 0;

  const todayChartData = await getChartDataForPeriod(workspace.id, todayStart, todayEnd, dayStartTime);
  const weekChartData = await getChartDataForPeriod(workspace.id, weekStart, weekEnd, dayStartTime);
  const monthChartData = await getChartDataForPeriod(workspace.id, monthStart, monthEnd, dayStartTime);
  const periodChartData = await getChartDataForPeriod(workspace.id, selectedStartDate, selectedEndDate, dayStartTime);

  let allTimeChartData: {
    timeSeries: { date: string; count: number }[];
    topCocktails: { cocktailId: string; name: string; count: number }[];
    hourDistribution: { hour: number; count: number }[];
  } = { timeSeries: [], topCocktails: [], hourDistribution: [] };
  if (firstStat) {
    const allTimeStart = getStartOfDay(firstStat.date, dayStartTime);
    const allTimeEnd = getEndOfDay(now, dayStartTime);
    allTimeChartData = await getChartDataForPeriod(workspace.id, allTimeStart, allTimeEnd, dayStartTime);
  }

  return {
    data: {
      kpis: {
        today: {
          total: todayStats.total,
          delta: todayDelta,
          previousTotal: yesterdayStats.total,
          previousPeriodLabel: 'Gestern',
          avgPerHour: todayStats.avgPerHour,
          peakHour: todayStats.peakHour,
          peakDay: todayStats.peakDay,
          topCocktail: todayStats.topCocktail,
          revenue: todayStats.revenue,
        },
        week: {
          total: weekStats.total,
          delta: weekDelta,
          previousTotal: lastWeekStats.total,
          previousPeriodLabel: 'Letzte Woche',
          topCocktail: weekStats.topCocktail,
          revenue: weekStats.revenue,
        },
        month: {
          total: monthStats.total,
          delta: monthDelta,
          previousTotal: lastMonthStats.total,
          previousPeriodLabel: 'Letzter Monat',
          topCocktail: monthStats.topCocktail,
          revenue: monthStats.revenue,
        },
        period: {
          total: periodTotal,
          topCocktail:
            periodChartData.topCocktails.length > 0 ? { name: periodChartData.topCocktails[0].name, count: periodChartData.topCocktails[0].count } : null,
          revenue: periodRevenue,
        },
        avgPerHour: {
          value: todayStats.avgPerHour,
          delta: avgPerHourDelta,
          previousValue: yesterdayStats.avgPerHour,
          previousPeriodLabel: 'Gestern',
        },
        allTime: {
          total: allTimeStats.total,
          avgPerDay: allTimeStats.avgPerDay,
          daysActive: allTimeStats.daysActive,
          topCocktail: allTimeStats.topCocktail,
          revenue: allTimeStats.revenue,
        },
      },
      charts: {
        today: todayChartData,
        week: weekChartData,
        month: monthChartData,
        period: periodChartData,
        allTime: allTimeChartData,
      },
      timeSeries: periodChartData.timeSeries,
      topCocktails: periodChartData.topCocktails,
      hourDistribution: periodChartData.hourDistribution,
    },
  };
}

// ────────────── cocktails (ranking) ──────────────

export async function getCocktailRanking(workspace: Workspace, opts: { startDate?: string; endDate?: string }): Promise<unknown> {
  const { startDate, endDate } = opts;
  if (!startDate || !endDate) {
    throw new ApiError(400, 'DATE_RANGE_REQUIRED', 'startDate and endDate are required');
  }

  const dayStartTime = await getDayStartTime(workspace.id);
  const start = getStartOfDay(new Date(startDate), dayStartTime);
  const end = getEndOfDay(new Date(endDate), dayStartTime);

  const periodLength = end.getTime() - start.getTime();
  const previousEnd = new Date(start);
  previousEnd.setTime(previousEnd.getTime() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setTime(previousStart.getTime() - periodLength);

  const currentStats = await prisma.cocktailStatisticItem.groupBy({
    by: ['cocktailId'],
    where: { workspaceId: workspace.id, date: { gte: start, lte: end } },
    _count: { cocktailId: true },
  });

  const previousStats = await prisma.cocktailStatisticItem.groupBy({
    by: ['cocktailId'],
    where: { workspaceId: workspace.id, date: { gte: previousStart, lte: previousEnd } },
    _count: { cocktailId: true },
  });

  const totalCurrent = currentStats.reduce((sum, stat) => sum + stat._count.cocktailId, 0);
  const previousMap = new Map(previousStats.map((stat) => [stat.cocktailId, stat._count.cocktailId]));

  const cocktailsWithStats = await Promise.all(
    currentStats.map(async (stat) => {
      const cocktail = await prisma.cocktailRecipe.findUnique({
        where: { id: stat.cocktailId },
        select: {
          id: true,
          name: true,
          tags: true,
          steps: {
            include: {
              ingredients: {
                include: {
                  ingredient: {
                    select: { id: true, name: true, price: true, IngredientVolume: { include: { unit: true } } },
                  },
                  unit: true,
                },
              },
            },
          },
        },
      });

      if (!cocktail) return null;

      const currentCount = stat._count.cocktailId;
      const previousCount = previousMap.get(stat.cocktailId) || 0;
      const percentage = totalCurrent > 0 ? (currentCount / totalCurrent) * 100 : 0;
      const delta = previousCount > 0 ? ((currentCount - previousCount) / previousCount) * 100 : currentCount > 0 ? 100 : 0;

      const ingredients = cocktail.steps.flatMap((step) =>
        step.ingredients
          .filter((ing) => ing.ingredient != null && ing.unit != null)
          .map((ing) => ({
            ingredientId: ing.ingredient!.id,
            ingredientName: ing.ingredient!.name,
            ingredientPrice: ing.ingredient!.price || 0,
            amount: ing.amount || 0,
            unitId: ing.unit!.id,
            unitName: ing.unit!.name,
            availableUnits: ing.ingredient!.IngredientVolume.map((iv) => ({ unitId: iv.unitId, unitName: iv.unit.name, volume: iv.volume })),
          })),
      );

      return {
        cocktailId: cocktail.id,
        name: cocktail.name,
        tags: cocktail.tags || [],
        count: currentCount,
        percentage,
        delta,
        previousCount,
        ingredients,
      };
    }),
  );

  const filtered = cocktailsWithStats.filter((c): c is NonNullable<typeof c> => c !== null);
  filtered.sort((a, b) => b.count - a.count);

  const withRanking = filtered.map((cocktail, index) => ({ ...cocktail, rank: index + 1 }));

  return { data: withRanking, total: totalCurrent };
}

// ────────────── cocktails/all ──────────────

export async function getCocktailsAll(workspace: Workspace, opts: { startDate?: string; endDate?: string }): Promise<unknown> {
  const dayStartTime = await getDayStartTime(workspace.id);

  const allCocktails = await prisma.cocktailRecipe.findMany({
    where: { workspaceId: workspace.id },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  const cocktailOrderCounts: Record<string, number> = {};
  let total = 0;

  if (opts.startDate && opts.endDate) {
    const start = getStartOfDay(new Date(opts.startDate), dayStartTime);
    const end = getEndOfDay(new Date(opts.endDate), dayStartTime);

    const stats = await prisma.cocktailStatisticItem.groupBy({
      by: ['cocktailId'],
      where: { workspaceId: workspace.id, date: { gte: start, lte: end } },
      _count: { id: true },
    });

    stats.forEach((stat) => {
      cocktailOrderCounts[stat.cocktailId] = stat._count.id;
      total += stat._count.id;
    });
  }

  const cocktailsWithStats = allCocktails.map((cocktail) => ({
    id: cocktail.id,
    name: cocktail.name,
    count: cocktailOrderCounts[cocktail.id] || 0,
  }));

  return { data: cocktailsWithStats, total };
}

// ────────────── cocktails/{cocktailId} ──────────────

function determineGranularity(startDate: Date, endDate: Date): 'hour' | 'day' | 'week' | 'month' {
  const diffMs = endDate.getTime() - startDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays <= 1) return 'hour';
  if (diffDays <= 7) return 'day';
  if (diffDays <= 90) return 'week';
  return 'month';
}

export async function getCocktailDetail(workspace: Workspace, cocktailId: string, opts: { startDate?: string; endDate?: string }): Promise<unknown> {
  const cocktail = await prisma.cocktailRecipe.findFirst({
    where: { id: cocktailId, workspaceId: workspace.id },
    select: {
      id: true,
      name: true,
      tags: true,
      price: true,
      steps: { include: { ingredients: { include: { ingredient: true } } } },
    },
  });

  if (!cocktail) {
    throw new ApiError(404, 'NOT_FOUND', 'Cocktail not found');
  }

  const dayStartTime = await getDayStartTime(workspace.id);

  let start: Date;
  let end: Date;

  if (opts.startDate && opts.endDate) {
    start = getStartOfDay(new Date(opts.startDate), dayStartTime);
    end = getEndOfDay(new Date(opts.endDate), dayStartTime);
  } else {
    const firstStat = await prisma.cocktailStatisticItem.findFirst({
      where: { workspaceId: workspace.id, cocktailId },
      orderBy: { date: 'asc' },
    });

    const lastStat = await prisma.cocktailStatisticItem.findFirst({
      where: { workspaceId: workspace.id, cocktailId },
      orderBy: { date: 'desc' },
    });

    if (!firstStat) {
      return {
        data: {
          cocktail: { id: cocktail.id, name: cocktail.name, tags: cocktail.tags },
          total: 0,
          avgPerActiveHour: 0,
          rank: 0,
          delta: 0,
          timeSeries: [],
          hourDistribution: [],
          dayDistribution: [],
          ingredients: [],
        },
      };
    }

    start = getStartOfDay(firstStat.date, dayStartTime);
    end = lastStat ? getEndOfDay(lastStat.date, dayStartTime) : getEndOfDay(new Date(), dayStartTime);
  }

  const periodLength = end.getTime() - start.getTime();
  const previousEnd = new Date(start);
  previousEnd.setTime(previousEnd.getTime() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setTime(previousStart.getTime() - periodLength);

  const currentStats = await prisma.cocktailStatisticItem.findMany({
    where: { workspaceId: workspace.id, cocktailId, date: { gte: start, lte: end } },
    orderBy: { date: 'asc' },
  });

  const previousStats = await prisma.cocktailStatisticItem.findMany({
    where: { workspaceId: workspace.id, cocktailId, date: { gte: previousStart, lte: previousEnd } },
  });

  const total = currentStats.length;
  const previousTotal = previousStats.length;
  const delta = previousTotal > 0 ? ((total - previousTotal) / previousTotal) * 100 : total > 0 ? 100 : 0;

  const activeHours = new Set<string>();
  currentStats.forEach((stat) => {
    const date = new Date(stat.date);
    const logicalDate = getLogicalDate(date, dayStartTime);
    const hourKey = `${formatDateLocal(logicalDate)}_${date.getHours()}`;
    activeHours.add(hourKey);
  });
  const avgPerActiveHour = activeHours.size > 0 ? total / activeHours.size : 0;

  const allCocktailStats = await prisma.cocktailStatisticItem.groupBy({
    by: ['cocktailId'],
    where: { workspaceId: workspace.id, date: { gte: start, lte: end } },
    _count: { cocktailId: true },
    orderBy: { _count: { cocktailId: 'desc' } },
  });

  const rank = allCocktailStats.findIndex((stat) => stat.cocktailId === cocktailId) + 1;

  const granularity = determineGranularity(start, end);
  const timeSeriesMap: Record<string, number> = {};

  currentStats.forEach((stat) => {
    const date = new Date(stat.date);
    const logicalDate = getLogicalDate(date, dayStartTime);
    let key: string;

    if (granularity === 'hour') {
      key = `${formatDateLocal(logicalDate)}T${date.getHours().toString().padStart(2, '0')}:00:00`;
    } else if (granularity === 'day') {
      key = formatDateLocal(logicalDate);
    } else if (granularity === 'week') {
      const weekStart = getStartOfWeek(logicalDate, dayStartTime);
      key = formatDateLocal(weekStart);
    } else {
      key = `${logicalDate.getFullYear()}-${(logicalDate.getMonth() + 1).toString().padStart(2, '0')}`;
    }

    timeSeriesMap[key] = (timeSeriesMap[key] || 0) + 1;
  });

  const timeSeries = Object.entries(timeSeriesMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  const hourDistribution: Record<number, number> = {};
  currentStats.forEach((stat) => {
    const hour = new Date(stat.date).getHours();
    hourDistribution[hour] = (hourDistribution[hour] || 0) + 1;
  });

  const hourDistributionArray = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: hourDistribution[i] || 0 }));

  const dayDistribution: Record<number, number> = {};
  currentStats.forEach((stat) => {
    const logicalDate = getLogicalDate(new Date(stat.date), dayStartTime);
    const day = logicalDate.getDay();
    dayDistribution[day] = (dayDistribution[day] || 0) + 1;
  });

  const dayDistributionArray = Array.from({ length: 7 }, (_, i) => ({ day: i, count: dayDistribution[i] || 0 }));

  const ingredients = new Set<string>();
  cocktail.steps.forEach((step) => {
    step.ingredients.forEach((ing) => {
      if (ing.ingredient) {
        ingredients.add(ing.ingredient.name);
      }
    });
  });

  const revenue = total * (cocktail.price || 0);
  const previousRevenue = previousTotal * (cocktail.price || 0);

  return {
    data: {
      cocktail: { id: cocktail.id, name: cocktail.name, tags: cocktail.tags, price: cocktail.price || 0 },
      total,
      avgPerActiveHour,
      rank,
      delta,
      previousTotal,
      revenue,
      previousRevenue,
      timeSeries,
      hourDistribution: hourDistributionArray,
      dayDistribution: dayDistributionArray,
      ingredients: Array.from(ingredients),
    },
  };
}

// ────────────── cocktails/{cocktailId}/orders ──────────────

export async function getCocktailOrders(
  workspace: Workspace,
  cocktailId: string,
  opts: { startDate?: string; endDate?: string; page?: string; limit?: string; search?: string },
): Promise<unknown> {
  const cocktail = await prisma.cocktailRecipe.findFirst({
    where: { id: cocktailId, workspaceId: workspace.id },
    select: { id: true, name: true },
  });

  if (!cocktail) {
    throw new ApiError(404, 'NOT_FOUND', 'Cocktail not found');
  }

  const dayStartTime = await getDayStartTime(workspace.id);

  const pageNumber = opts.page ? parseInt(opts.page, 10) : 1;
  const pageSize = opts.limit ? parseInt(opts.limit, 10) : 50;
  const skip = (pageNumber - 1) * pageSize;
  const take = pageSize;

  const where: Prisma.CocktailStatisticItemWhereInput = { workspaceId: workspace.id, cocktailId };

  if (opts.startDate || opts.endDate) {
    const dateFilter: Prisma.DateTimeFilter = {};
    if (opts.startDate) {
      dateFilter.gte = getStartOfDay(new Date(opts.startDate), dayStartTime);
    }
    if (opts.endDate) {
      dateFilter.lte = getEndOfDay(new Date(opts.endDate), dayStartTime);
    }
    where.date = dateFilter;
  }

  const allOrders = await prisma.cocktailStatisticItem.findMany({
    where,
    orderBy: { date: 'desc' },
    include: {
      user: { select: { name: true, email: true } },
      cocktailCard: { select: { name: true } },
    },
  });

  const formatDateWithWeekday = (date: Date): string => {
    const weekdays = ['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.'];
    const weekday = weekdays[date.getDay()];
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString().slice(-2);
    return `${weekday} ${day}.${month}.${year}`;
  };

  let formattedOrders = allOrders.map((order) => {
    const orderDate = new Date(order.date);
    return {
      id: order.id,
      date: order.date,
      dateFormatted: formatDateWithWeekday(orderDate),
      dateFormattedShort: `${orderDate.getDate()}.${(orderDate.getMonth() + 1).toString().padStart(2, '0')}.`,
      weekday: ['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.'][orderDate.getDay()],
      user: order.user ? { name: order.user.name, email: order.user.email } : null,
      cocktailCard: order.cocktailCard ? { name: order.cocktailCard.name } : null,
    };
  });

  const search = opts.search;
  if (search && typeof search === 'string' && search.trim()) {
    const searchLower = search.trim().toLowerCase();
    formattedOrders = formattedOrders.filter((order) => {
      const dateFormattedStr = order.dateFormatted.toLowerCase();
      const dateShortStr = order.dateFormattedShort.toLowerCase();
      const weekdayStr = order.weekday.toLowerCase();
      const dateFullStr = new Date(order.date).toLocaleString('de-DE').toLowerCase();
      const userStr = order.user ? `${order.user.name} ${order.user.email || ''}`.toLowerCase() : '';
      const cardStr = order.cocktailCard ? order.cocktailCard.name.toLowerCase() : '';
      return (
        dateFormattedStr.includes(searchLower) ||
        dateShortStr.includes(searchLower) ||
        weekdayStr.includes(searchLower) ||
        dateFullStr.includes(searchLower) ||
        userStr.includes(searchLower) ||
        cardStr.includes(searchLower)
      );
    });
  }

  const finalTotal = formattedOrders.length;
  const paginatedOrders = formattedOrders.slice(skip, skip + take);

  const ordersToSend = paginatedOrders.map((order) => ({
    id: order.id,
    date: order.date,
    user: order.user,
    cocktailCard: order.cocktailCard,
  }));

  return {
    data: ordersToSend,
    pagination: {
      page: pageNumber,
      limit: pageSize,
      total: finalTotal,
      totalPages: Math.ceil(finalTotal / pageSize),
    },
  };
}

// ────────────── ingredients ──────────────

export async function getIngredients(workspace: Workspace, opts: { startDate?: string; endDate?: string }): Promise<unknown> {
  const dayStartTime = await getDayStartTime(workspace.id);

  const allIngredients = await prisma.ingredient.findMany({
    where: { workspaceId: workspace.id },
    select: { id: true, name: true },
  });

  const cocktailsWithIngredients = await prisma.cocktailRecipe.findMany({
    where: { workspaceId: workspace.id },
    select: {
      id: true,
      steps: { select: { ingredients: { select: { ingredient: { select: { name: true } } } } } },
    },
  });

  const ingredientCocktailMap: Record<string, Set<string>> = {};
  cocktailsWithIngredients.forEach((cocktail) => {
    cocktail.steps.forEach((step) => {
      step.ingredients.forEach((ing) => {
        if (ing.ingredient?.name) {
          if (!ingredientCocktailMap[ing.ingredient.name]) {
            ingredientCocktailMap[ing.ingredient.name] = new Set();
          }
          ingredientCocktailMap[ing.ingredient.name].add(cocktail.id);
        }
      });
    });
  });

  const ingredientOrderCounts: Record<string, number> = {};
  let total = 0;

  if (opts.startDate && opts.endDate) {
    const start = getStartOfDay(new Date(opts.startDate), dayStartTime);
    const end = getEndOfDay(new Date(opts.endDate), dayStartTime);

    const stats = await prisma.cocktailStatisticItem.findMany({
      where: { workspaceId: workspace.id, date: { gte: start, lte: end } },
      include: {
        cocktail: { include: { steps: { include: { ingredients: { include: { ingredient: { select: { name: true } } } } } } } },
      },
    });

    total = stats.length;

    stats.forEach((stat) => {
      const ingredientNames = new Set<string>();
      stat.cocktail.steps.forEach((step) => {
        step.ingredients.forEach((ing) => {
          if (ing.ingredient?.name) {
            ingredientNames.add(ing.ingredient.name);
          }
        });
      });

      ingredientNames.forEach((name) => {
        ingredientOrderCounts[name] = (ingredientOrderCounts[name] || 0) + 1;
      });
    });
  }

  const ingredientsWithStats = allIngredients
    .map((ingredient) => ({
      ingredient: ingredient.name,
      count: ingredientOrderCounts[ingredient.name] || 0,
      cocktailCount: ingredientCocktailMap[ingredient.name]?.size || 0,
      percentage: total > 0 ? ((ingredientOrderCounts[ingredient.name] || 0) / total) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count || a.ingredient.localeCompare(b.ingredient));

  return { data: ingredientsWithStats, total };
}

// ────────────── tags ──────────────

export async function getTags(workspace: Workspace, opts: { startDate?: string; endDate?: string }): Promise<unknown> {
  const dayStartTime = await getDayStartTime(workspace.id);

  const allCocktails = await prisma.cocktailRecipe.findMany({
    where: { workspaceId: workspace.id },
    select: { id: true, tags: true },
  });

  const allTags: Record<string, Set<string>> = {};
  allCocktails.forEach((cocktail) => {
    (cocktail.tags || []).forEach((tag) => {
      if (!allTags[tag]) {
        allTags[tag] = new Set();
      }
      allTags[tag].add(cocktail.id);
    });
  });

  const tagCounts: Record<string, number> = {};
  let total = 0;

  if (opts.startDate && opts.endDate) {
    const start = getStartOfDay(new Date(opts.startDate), dayStartTime);
    const end = getEndOfDay(new Date(opts.endDate), dayStartTime);

    const stats = await prisma.cocktailStatisticItem.findMany({
      where: { workspaceId: workspace.id, date: { gte: start, lte: end } },
      include: { cocktail: { select: { tags: true } } },
    });

    total = stats.length;

    stats.forEach((stat) => {
      const tags = stat.cocktail.tags || [];
      tags.forEach((tag) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
  }

  const tagsWithStats = Object.entries(allTags)
    .map(([tag, cocktailIds]) => ({
      tag,
      count: tagCounts[tag] || 0,
      cocktailCount: cocktailIds.size,
      percentage: total > 0 ? ((tagCounts[tag] || 0) / total) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));

  return { data: tagsWithStats, total };
}

// ────────────── compare ──────────────

export async function compareSet(
  workspace: Workspace,
  opts: { type: 'TAG_SET' | 'INGREDIENT_SET'; items: string; logic?: 'AND' | 'OR'; startDate?: string; endDate?: string },
): Promise<unknown> {
  const { type } = opts;
  const dayStartTime = await getDayStartTime(workspace.id);

  let itemArray: string[];
  if (typeof opts.items === 'string') {
    try {
      itemArray = JSON.parse(opts.items);
    } catch {
      itemArray = [opts.items];
    }
  } else if (Array.isArray(opts.items)) {
    itemArray = opts.items as string[];
  } else {
    itemArray = [opts.items as string];
  }

  const comparisonLogic = opts.logic || 'AND';

  let start: Date;
  let end: Date;

  if (opts.startDate && opts.endDate) {
    start = getStartOfDay(new Date(opts.startDate), dayStartTime);
    end = getEndOfDay(new Date(opts.endDate), dayStartTime);
  } else {
    start = new Date(0);
    end = new Date();
  }

  let matchingCocktailIds: string[] = [];

  if (type === 'TAG_SET') {
    const cocktails = await prisma.cocktailRecipe.findMany({
      where: {
        workspaceId: workspace.id,
        tags: comparisonLogic === 'AND' ? { hasEvery: itemArray } : { hasSome: itemArray },
      },
      select: { id: true },
    });
    matchingCocktailIds = cocktails.map((c) => c.id);
  } else if (type === 'INGREDIENT_SET') {
    if (comparisonLogic === 'AND') {
      const cocktails = await prisma.cocktailRecipe.findMany({
        where: { workspaceId: workspace.id },
        select: { id: true, steps: { select: { ingredients: { select: { ingredient: { select: { name: true } } } } } } },
      });

      matchingCocktailIds = cocktails
        .filter((cocktail) => {
          const cocktailIngredientNames = new Set<string>();
          cocktail.steps.forEach((step) => {
            step.ingredients.forEach((ing) => {
              if (ing.ingredient?.name) {
                cocktailIngredientNames.add(ing.ingredient.name);
              }
            });
          });
          return itemArray.every((ingredientName) => cocktailIngredientNames.has(ingredientName));
        })
        .map((c) => c.id);
    } else {
      const cocktails = await prisma.cocktailRecipe.findMany({
        where: {
          workspaceId: workspace.id,
          steps: { some: { ingredients: { some: { ingredient: { name: { in: itemArray } } } } } },
        },
        select: { id: true },
      });
      matchingCocktailIds = cocktails.map((c) => c.id);
    }
  }

  const allStats = await prisma.cocktailStatisticItem.findMany({
    where: { workspaceId: workspace.id, date: { gte: start, lte: end } },
  });

  const uniqueCocktailIdsInPeriod = new Set(allStats.map((stat) => stat.cocktailId));
  const totalUniqueCocktailsInPeriod = uniqueCocktailIdsInPeriod.size;

  const totalCocktailsInWorkspace = await prisma.cocktailRecipe.count({ where: { workspaceId: workspace.id } });

  const cocktailPercentageAll = totalCocktailsInWorkspace > 0 ? (matchingCocktailIds.length / totalCocktailsInWorkspace) * 100 : 0;

  if (matchingCocktailIds.length === 0) {
    return {
      data: {
        set: {
          name: type === 'TAG_SET' ? `Tags: ${itemArray.join(', ')}` : `Ingredients: ${itemArray.join(', ')}`,
          type,
          logic: comparisonLogic,
        },
        kpis: {
          total: 0,
          percentage: 0,
          cocktailCount: 0,
          totalStats: allStats.length,
          totalUniqueCocktailsInPeriod,
          cocktailPercentage: 0,
          totalCocktailsInWorkspace,
          cocktailPercentageAll,
          revenue: 0,
          totalRevenue: 0,
        },
        cocktails: [],
        aggregated: [],
      },
    };
  }

  const stats = await prisma.cocktailStatisticItem.findMany({
    where: { workspaceId: workspace.id, cocktailId: { in: matchingCocktailIds }, date: { gte: start, lte: end } },
    include: { cocktail: { select: { price: true } } },
  });

  const total = stats.length;
  const percentage = allStats.length > 0 ? (total / allStats.length) * 100 : 0;
  const revenue = stats.reduce((sum, stat) => sum + (stat.cocktail?.price || 0), 0);

  const allStatsWithPrices = await prisma.cocktailStatisticItem.findMany({
    where: { workspaceId: workspace.id, date: { gte: start, lte: end } },
    include: { cocktail: { select: { price: true } } },
  });
  const totalRevenue = allStatsWithPrices.reduce((sum, stat) => sum + (stat.cocktail?.price || 0), 0);

  const cocktailPercentage = totalUniqueCocktailsInPeriod > 0 ? (matchingCocktailIds.length / totalUniqueCocktailsInPeriod) * 100 : 0;

  const cocktails = await prisma.cocktailRecipe.findMany({
    where: { id: { in: matchingCocktailIds } },
    select: { id: true, name: true },
  });

  const cocktailCounts: Record<string, number> = {};
  stats.forEach((stat) => {
    cocktailCounts[stat.cocktailId] = (cocktailCounts[stat.cocktailId] || 0) + 1;
  });

  const cocktailsWithCounts = cocktails
    .map((cocktail) => ({ cocktailId: cocktail.id, name: cocktail.name, count: cocktailCounts[cocktail.id] || 0 }))
    .sort((a, b) => b.count - a.count);

  let aggregatedData: Array<{ name: string; count: number }> = [];

  if (type === 'TAG_SET') {
    const ingredientCounts: Record<string, number> = {};
    const cocktailsWithIngredients = await prisma.cocktailRecipe.findMany({
      where: { id: { in: matchingCocktailIds } },
      include: { steps: { include: { ingredients: { include: { ingredient: { select: { name: true } } } } } } },
    });

    cocktailsWithIngredients.forEach((cocktail) => {
      cocktail.steps.forEach((step) => {
        step.ingredients.forEach((ing) => {
          if (ing.ingredient?.name) {
            ingredientCounts[ing.ingredient.name] = (ingredientCounts[ing.ingredient.name] || 0) + 1;
          }
        });
      });
    });

    aggregatedData = Object.entries(ingredientCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  } else if (type === 'INGREDIENT_SET') {
    const tagCounts: Record<string, number> = {};
    const cocktailsWithTags = await prisma.cocktailRecipe.findMany({
      where: { id: { in: matchingCocktailIds } },
      select: { tags: true },
    });

    cocktailsWithTags.forEach((cocktail) => {
      (cocktail.tags || []).forEach((tag) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    aggregatedData = Object.entries(tagCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }

  return {
    data: {
      set: {
        name: type === 'TAG_SET' ? `Tags: ${itemArray.join(', ')}` : `Ingredients: ${itemArray.join(', ')}`,
        type,
        logic: comparisonLogic,
      },
      kpis: {
        total,
        percentage,
        cocktailCount: matchingCocktailIds.length,
        totalStats: allStats.length,
        totalUniqueCocktailsInPeriod,
        cocktailPercentage,
        totalCocktailsInWorkspace,
        cocktailPercentageAll,
        revenue,
        totalRevenue,
      },
      cocktails: cocktailsWithCounts,
      aggregated: aggregatedData,
    },
  };
}

// ────────────── sets (collection) ──────────────

export async function listSavedSets(workspace: Workspace, opts: { type?: string; types?: string }): Promise<unknown> {
  const where: Prisma.StatisticSavedSetWhereInput = { workspaceId: workspace.id };

  if (opts.type) {
    where.type = opts.type as SavedSetType;
  } else if (opts.types) {
    const typeList = opts.types.split(',').filter((t) => Object.values(SavedSetType).includes(t as SavedSetType));
    if (typeList.length > 0) {
      where.type = { in: typeList as SavedSetType[] };
    }
  }

  const sets = await prisma.statisticSavedSet.findMany({ where, orderBy: { createdAt: 'desc' } });

  return { data: sets };
}

export async function createSavedSet(workspace: Workspace, input: { name: string; type: string; logic?: string | null; items: string[] }): Promise<unknown> {
  const { name, type, logic, items } = input;

  if (!name || !type || !items || !Array.isArray(items)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'name, type, and items (array) are required');
  }

  if (!Object.values(SavedSetType).includes(type as SavedSetType)) {
    throw new ApiError(400, 'INVALID_TYPE', 'Invalid type');
  }

  if (logic && !Object.values(SavedSetLogic).includes(logic as SavedSetLogic)) {
    throw new ApiError(400, 'INVALID_LOGIC', 'Invalid logic');
  }

  const set = await prisma.statisticSavedSet.create({
    data: {
      workspaceId: workspace.id,
      name,
      type: type as SavedSetType,
      logic: logic ? (logic as SavedSetLogic) : null,
      items,
    },
  });

  return { data: set };
}

export async function updateSavedSet(workspace: Workspace, input: { id?: string; name?: string; logic?: string | null; items?: string[] }): Promise<unknown> {
  const { id, name, logic, items } = input;

  if (!id) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'id is required');
  }

  const existingSet = await prisma.statisticSavedSet.findFirst({ where: { id, workspaceId: workspace.id } });

  if (!existingSet) {
    throw new ApiError(404, 'NOT_FOUND', 'Set not found');
  }

  const updateData: Prisma.StatisticSavedSetUpdateInput = {};
  if (name !== undefined) updateData.name = name;
  if (logic !== undefined) updateData.logic = logic ? (logic as SavedSetLogic) : null;
  if (items !== undefined) updateData.items = items;

  const set = await prisma.statisticSavedSet.update({ where: { id }, data: updateData });

  return { data: set };
}

export async function deleteSavedSet(workspace: Workspace, id: string | undefined): Promise<{ count: number }> {
  if (!id) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'id is required');
  }

  const existingSet = await prisma.statisticSavedSet.findFirst({ where: { id, workspaceId: workspace.id } });

  if (!existingSet) {
    throw new ApiError(404, 'NOT_FOUND', 'Set not found');
  }

  await prisma.statisticSavedSet.delete({ where: { id } });

  return { count: 1 };
}

// ────────────── sets/{setId} ──────────────

export async function getSavedSetDetail(workspace: Workspace, setId: string, opts: { startDate?: string; endDate?: string }): Promise<unknown> {
  const dayStartTime = await getDayStartTime(workspace.id);

  const set = await prisma.statisticSavedSet.findFirst({ where: { id: setId, workspaceId: workspace.id } });

  if (!set) {
    throw new ApiError(404, 'NOT_FOUND', 'Set not found');
  }

  const items = set.items as string[];

  let start: Date;
  let end: Date;

  if (opts.startDate && opts.endDate) {
    start = getStartOfDay(new Date(opts.startDate), dayStartTime);
    end = getEndOfDay(new Date(opts.endDate), dayStartTime);
  } else {
    start = new Date(0);
    end = new Date();
  }

  let matchingCocktailIds: string[] = [];

  if (set.type === 'COCKTAIL_SET') {
    matchingCocktailIds = items;
  } else if (set.type === 'TAG_SET') {
    const cocktails = await prisma.cocktailRecipe.findMany({
      where: {
        workspaceId: workspace.id,
        tags: set.logic === 'AND' ? { hasEvery: items } : { hasSome: items },
      },
      select: { id: true },
    });
    matchingCocktailIds = cocktails.map((c) => c.id);
  } else if (set.type === 'INGREDIENT_SET') {
    const cocktails = await prisma.cocktailRecipe.findMany({
      where: {
        workspaceId: workspace.id,
        steps: { some: { ingredients: { some: { ingredient: { name: { in: items } } } } } },
      },
      select: { id: true },
    });
    matchingCocktailIds = cocktails.map((c) => c.id);
  }

  const stats = await prisma.cocktailStatisticItem.findMany({
    where: { workspaceId: workspace.id, cocktailId: { in: matchingCocktailIds }, date: { gte: start, lte: end } },
  });

  const total = stats.length;

  const allStats = await prisma.cocktailStatisticItem.findMany({
    where: { workspaceId: workspace.id, date: { gte: start, lte: end } },
  });

  const percentage = allStats.length > 0 ? (total / allStats.length) * 100 : 0;

  const uniqueCocktailIdsInPeriod = new Set(allStats.map((stat) => stat.cocktailId));
  const totalUniqueCocktailsInPeriod = uniqueCocktailIdsInPeriod.size;

  const cocktailPercentage = totalUniqueCocktailsInPeriod > 0 ? (matchingCocktailIds.length / totalUniqueCocktailsInPeriod) * 100 : 0;

  const totalCocktailsInWorkspace = await prisma.cocktailRecipe.count({ where: { workspaceId: workspace.id } });

  const cocktailPercentageAll = totalCocktailsInWorkspace > 0 ? (matchingCocktailIds.length / totalCocktailsInWorkspace) * 100 : 0;

  const cocktails = await prisma.cocktailRecipe.findMany({
    where: { id: { in: matchingCocktailIds } },
    select: { id: true, name: true },
  });

  const cocktailCounts: Record<string, number> = {};
  stats.forEach((stat) => {
    cocktailCounts[stat.cocktailId] = (cocktailCounts[stat.cocktailId] || 0) + 1;
  });

  const cocktailsWithCounts = cocktails
    .map((cocktail) => ({ cocktailId: cocktail.id, name: cocktail.name, count: cocktailCounts[cocktail.id] || 0 }))
    .sort((a, b) => b.count - a.count);

  let aggregatedData: Array<{ name: string; count: number }> = [];

  if (set.type === 'TAG_SET') {
    const ingredientCounts: Record<string, number> = {};
    const cocktailsWithIngredients = await prisma.cocktailRecipe.findMany({
      where: { id: { in: matchingCocktailIds } },
      include: { steps: { include: { ingredients: { include: { ingredient: { select: { name: true } } } } } } },
    });

    cocktailsWithIngredients.forEach((cocktail) => {
      cocktail.steps.forEach((step) => {
        step.ingredients.forEach((ing) => {
          if (ing.ingredient) {
            ingredientCounts[ing.ingredient.name] = (ingredientCounts[ing.ingredient.name] || 0) + 1;
          }
        });
      });
    });

    aggregatedData = Object.entries(ingredientCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  } else if (set.type === 'INGREDIENT_SET') {
    const tagCounts: Record<string, number> = {};
    const cocktailsWithTags = await prisma.cocktailRecipe.findMany({
      where: { id: { in: matchingCocktailIds } },
      select: { tags: true },
    });

    cocktailsWithTags.forEach((cocktail) => {
      cocktail.tags.forEach((tag) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    aggregatedData = Object.entries(tagCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }

  return {
    data: {
      set: { id: set.id, name: set.name, type: set.type, logic: set.logic, items: set.items },
      kpis: {
        total,
        percentage,
        cocktailCount: matchingCocktailIds.length,
        totalStats: allStats.length,
        totalUniqueCocktailsInPeriod,
        cocktailPercentage,
        totalCocktailsInWorkspace,
        cocktailPercentageAll,
      },
      cocktails: cocktailsWithCounts,
      aggregated: aggregatedData,
    },
  };
}
