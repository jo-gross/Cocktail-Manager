import prisma from '../../../../../../../prisma/prisma';
import { NextApiRequest, NextApiResponse } from 'next';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { Permission, Role, WorkspaceSettingKey } from '@generated/prisma/client';
import HTTPMethod from 'http-method-enum';
import '../../../../../../../lib/DateUtils';
import { getEndOfDay, getLogicalDate, getStartOfDay, getStartOfMonth, getStartOfWeek } from '../../../../../../../lib/dateHelpers';

async function getStatisticsForPeriod(workspaceId: string, startDate: Date, endDate: Date, dayStartTime?: string) {
  const stats = await prisma.cocktailStatisticItem.findMany({
    where: {
      workspaceId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      cocktail: {
        select: {
          id: true,
          name: true,
          price: true,
        },
      },
    },
  });

  const total = stats.length;
  const hours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
  const avgPerHour = hours > 0 ? total / hours : 0;

  // Find peak hour
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

  // Find peak day (0 = Sunday, 1 = Monday, etc.)
  // Use logical date based on dayStartTime to correctly assign orders to days
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

  // Calculate top cocktail and revenue
  const cocktailCounts: Record<string, { count: number; name: string; price: number }> = {};
  stats.forEach((stat) => {
    const cocktailId = stat.cocktailId;
    if (!cocktailCounts[cocktailId]) {
      cocktailCounts[cocktailId] = {
        count: 0,
        name: stat.cocktail?.name || 'Unknown',
        price: stat.cocktail?.price || 0,
      };
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

  // Calculate revenue
  let revenue = 0;
  stats.forEach((stat) => {
    revenue += stat.cocktail?.price || 0;
  });

  return {
    total,
    avgPerHour,
    peakHour,
    peakDay,
    topCocktail,
    revenue,
  };
}

async function getChartDataForPeriod(workspaceId: string, startDate: Date, endDate: Date, dayStartTime?: string) {
  const stats = await prisma.cocktailStatisticItem.findMany({
    where: {
      workspaceId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: {
      date: 'asc',
    },
  });

  // Group by logical day for time series (respecting dayStartTime)
  const dayGroups: Record<string, number> = {};
  stats.forEach((stat) => {
    const logicalDate = getLogicalDate(new Date(stat.date), dayStartTime);
    const dateKey = logicalDate.toISOString().split('T')[0];
    dayGroups[dateKey] = (dayGroups[dateKey] || 0) + 1;
  });

  const timeSeries = Object.entries(dayGroups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  // Get top cocktails
  const topCocktails = await prisma.cocktailStatisticItem.groupBy({
    by: ['cocktailId'],
    where: {
      workspaceId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    _count: {
      cocktailId: true,
    },
    orderBy: {
      _count: {
        cocktailId: 'desc',
      },
    },
    take: 10,
  });

  const topCocktailsWithNames = await Promise.all(
    topCocktails.map(async (item) => {
      const cocktail = await prisma.cocktailRecipe.findUnique({
        where: { id: item.cocktailId },
        select: { name: true },
      });
      return {
        cocktailId: item.cocktailId,
        name: cocktail?.name || 'Unknown',
        count: item._count.cocktailId,
      };
    }),
  );

  // Get distribution by hour
  const hourDistribution: Record<number, number> = {};
  stats.forEach((stat) => {
    const hour = new Date(stat.date).getHours();
    hourDistribution[hour] = (hourDistribution[hour] || 0) + 1;
  });

  const hourDistributionArray = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    count: hourDistribution[i] || 0,
  }));

  return {
    timeSeries,
    topCocktails: topCocktailsWithNames,
    hourDistribution: hourDistributionArray,
  };
}

export default withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.USER], Permission.STATISTICS_READ, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const now = new Date();

    // Load workspace day start time setting
    const dayStartTimeSetting = await prisma.workspaceSetting.findUnique({
      where: {
        workspaceId_setting: {
          workspaceId: workspace.id,
          setting: WorkspaceSettingKey.statisticDayStartTime,
        },
      },
    });
    const dayStartTime = dayStartTimeSetting?.value || undefined;

    // Check if custom date range is provided
    const customStartDate = req.query.startDate as string | undefined;
    const customEndDate = req.query.endDate as string | undefined;

    let selectedStartDate: Date;
    let selectedEndDate: Date;

    if (customStartDate && customEndDate) {
      selectedStartDate = new Date(customStartDate);
      selectedEndDate = new Date(customEndDate);
      // Ensure we're working with full days
      selectedStartDate = getStartOfDay(selectedStartDate, dayStartTime);
      selectedEndDate = getEndOfDay(selectedEndDate, dayStartTime);
    } else {
      // Default to last 7 days
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
    // Ensure last week dates respect dayStartTime
    const lastWeekStartAdjusted = getStartOfDay(lastWeekStart, dayStartTime);
    const lastWeekEndAdjusted = getEndOfDay(lastWeekEnd, dayStartTime);

    const monthStart = getStartOfMonth(now, dayStartTime);
    const monthEnd = getEndOfDay(now, dayStartTime);
    const lastMonthStart = new Date(monthStart);
    lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
    const lastMonthEnd = new Date(monthStart);
    lastMonthEnd.setDate(0); // Last day of previous month
    // Ensure last month dates respect dayStartTime
    const lastMonthStartAdjusted = getStartOfDay(lastMonthStart, dayStartTime);
    const lastMonthEndAdjusted = getEndOfDay(lastMonthEnd, dayStartTime);

    // Get statistics for current periods
    const todayStats = await getStatisticsForPeriod(workspace.id, todayStart, todayEnd, dayStartTime);
    const weekStats = await getStatisticsForPeriod(workspace.id, weekStart, weekEnd, dayStartTime);
    const monthStats = await getStatisticsForPeriod(workspace.id, monthStart, monthEnd, dayStartTime);

    // Get statistics for comparison periods
    const yesterdayStats = await getStatisticsForPeriod(workspace.id, yesterdayStart, yesterdayEnd, dayStartTime);
    const lastWeekStats = await getStatisticsForPeriod(workspace.id, lastWeekStartAdjusted, lastWeekEndAdjusted, dayStartTime);
    const lastMonthStats = await getStatisticsForPeriod(workspace.id, lastMonthStartAdjusted, lastMonthEndAdjusted, dayStartTime);

    // Get all-time statistics
    const firstStat = await prisma.cocktailStatisticItem.findFirst({
      where: {
        workspaceId: workspace.id,
      },
      orderBy: {
        date: 'asc',
      },
    });

    let allTimeStats = { total: 0, avgPerDay: 0, daysActive: 0, topCocktail: null, revenue: 0 };
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

    // Calculate revenue for period (selected date range)
    const periodStats = await prisma.cocktailStatisticItem.findMany({
      where: {
        workspaceId: workspace.id,
        date: {
          gte: selectedStartDate,
          lte: selectedEndDate,
        },
      },
      include: {
        cocktail: {
          select: {
            price: true,
          },
        },
      },
    });
    const periodRevenue = periodStats.reduce((sum, stat) => sum + (stat.cocktail?.price || 0), 0);
    const periodTotal = periodStats.length;

    // Calculate deltas
    const todayDelta = yesterdayStats.total > 0 ? ((todayStats.total - yesterdayStats.total) / yesterdayStats.total) * 100 : 0;
    const weekDelta = lastWeekStats.total > 0 ? ((weekStats.total - lastWeekStats.total) / lastWeekStats.total) * 100 : 0;
    const monthDelta = lastMonthStats.total > 0 ? ((monthStats.total - lastMonthStats.total) / lastMonthStats.total) * 100 : 0;
    const avgPerHourDelta = yesterdayStats.avgPerHour > 0 ? ((todayStats.avgPerHour - yesterdayStats.avgPerHour) / yesterdayStats.avgPerHour) * 100 : 0;

    // Get chart data for each period
    const todayChartData = await getChartDataForPeriod(workspace.id, todayStart, todayEnd, dayStartTime);
    const weekChartData = await getChartDataForPeriod(workspace.id, weekStart, weekEnd, dayStartTime);
    const monthChartData = await getChartDataForPeriod(workspace.id, monthStart, monthEnd, dayStartTime);
    const periodChartData = await getChartDataForPeriod(workspace.id, selectedStartDate, selectedEndDate, dayStartTime);

    let allTimeChartData: {
      timeSeries: { date: string; count: number }[];
      topCocktails: { cocktailId: string; name: string; count: number }[];
      hourDistribution: { hour: number; count: number }[];
    } = {
      timeSeries: [],
      topCocktails: [],
      hourDistribution: [],
    };
    if (firstStat) {
      const allTimeStart = getStartOfDay(firstStat.date, dayStartTime);
      const allTimeEnd = getEndOfDay(now, dayStartTime);
      allTimeChartData = await getChartDataForPeriod(workspace.id, allTimeStart, allTimeEnd, dayStartTime);
    }

    return res.json({
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
        // Keep legacy fields for backward compatibility (use period data)
        timeSeries: periodChartData.timeSeries,
        topCocktails: periodChartData.topCocktails,
        hourDistribution: periodChartData.hourDistribution,
      },
    });
  }),
});
