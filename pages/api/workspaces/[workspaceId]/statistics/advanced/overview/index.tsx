import prisma from '../../../../../../../prisma/prisma';
import { NextApiRequest, NextApiResponse } from 'next';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { Role, Permission } from '@generated/prisma/client';
import HTTPMethod from 'http-method-enum';
import '../../../../../../../lib/DateUtils';
import { getStartOfDay, getEndOfDay, getStartOfWeek, getStartOfMonth } from '../../../../../../../lib/dateHelpers';

async function getStatisticsForPeriod(workspaceId: string, startDate: Date, endDate: Date) {
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
  const dayCounts: Record<number, number> = {};
  stats.forEach((stat) => {
    const day = new Date(stat.date).getDay();
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

export default withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.USER], Permission.STATISTICS_READ, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const now = new Date();

    // Check if custom date range is provided
    const customStartDate = req.query.startDate as string | undefined;
    const customEndDate = req.query.endDate as string | undefined;

    let selectedStartDate: Date;
    let selectedEndDate: Date;

    if (customStartDate && customEndDate) {
      selectedStartDate = new Date(customStartDate);
      selectedEndDate = new Date(customEndDate);
      // Ensure we're working with full days
      selectedStartDate = getStartOfDay(selectedStartDate);
      selectedEndDate = getEndOfDay(selectedEndDate);
    } else {
      // Default to last 7 days
      selectedStartDate = new Date(now);
      selectedStartDate.setDate(selectedStartDate.getDate() - 7);
      selectedStartDate = getStartOfDay(selectedStartDate);
      selectedEndDate = getEndOfDay(now);
    }

    const todayStart = getStartOfDay(now);
    const todayEnd = getEndOfDay(now);
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayEnd = new Date(todayEnd);
    yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);

    const weekStart = getStartOfWeek(now);
    const weekEnd = getEndOfDay(now);
    const lastWeekStart = new Date(weekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(weekStart);
    lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);
    lastWeekEnd.setHours(23, 59, 59, 999);

    const monthStart = getStartOfMonth(now);
    const monthEnd = getEndOfDay(now);
    const lastMonthStart = new Date(monthStart);
    lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
    const lastMonthEnd = new Date(monthStart);
    lastMonthEnd.setDate(0); // Last day of previous month
    lastMonthEnd.setHours(23, 59, 59, 999);

    // Get statistics for current periods
    const todayStats = await getStatisticsForPeriod(workspace.id, todayStart, todayEnd);
    const weekStats = await getStatisticsForPeriod(workspace.id, weekStart, weekEnd);
    const monthStats = await getStatisticsForPeriod(workspace.id, monthStart, monthEnd);

    // Get statistics for comparison periods
    const yesterdayStats = await getStatisticsForPeriod(workspace.id, yesterdayStart, yesterdayEnd);
    const lastWeekStats = await getStatisticsForPeriod(workspace.id, lastWeekStart, lastWeekEnd);
    const lastMonthStats = await getStatisticsForPeriod(workspace.id, lastMonthStart, lastMonthEnd);

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
      const allTimeStart = getStartOfDay(firstStat.date);
      const allTimeEnd = getEndOfDay(now);
      const allTimeData = await getStatisticsForPeriod(workspace.id, allTimeStart, allTimeEnd);
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

    // Calculate deltas
    const todayDelta = yesterdayStats.total > 0 ? ((todayStats.total - yesterdayStats.total) / yesterdayStats.total) * 100 : 0;
    const weekDelta = lastWeekStats.total > 0 ? ((weekStats.total - lastWeekStats.total) / lastWeekStats.total) * 100 : 0;
    const monthDelta = lastMonthStats.total > 0 ? ((monthStats.total - lastMonthStats.total) / lastMonthStats.total) * 100 : 0;
    const avgPerHourDelta = yesterdayStats.avgPerHour > 0 ? ((todayStats.avgPerHour - yesterdayStats.avgPerHour) / yesterdayStats.avgPerHour) * 100 : 0;

    // Get time series data for overview chart (use selected date range)
    const timeSeriesStats = await prisma.cocktailStatisticItem.findMany({
      where: {
        workspaceId: workspace.id,
        date: {
          gte: selectedStartDate,
          lte: selectedEndDate,
        },
      },
      orderBy: {
        date: 'asc',
      },
    });

    // Group by day
    const dayGroups: Record<string, number> = {};
    timeSeriesStats.forEach((stat) => {
      const dateKey = new Date(stat.date).toISOString().split('T')[0];
      dayGroups[dateKey] = (dayGroups[dateKey] || 0) + 1;
    });

    const timeSeries = Object.entries(dayGroups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    // Get top cocktails for the selected date range
    const topCocktails = await prisma.cocktailStatisticItem.groupBy({
      by: ['cocktailId'],
      where: {
        workspaceId: workspace.id,
        date: {
          gte: selectedStartDate,
          lte: selectedEndDate,
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

    // Get distribution by hour for the week
    const hourDistribution: Record<number, number> = {};
    timeSeriesStats.forEach((stat) => {
      const hour = new Date(stat.date).getHours();
      hourDistribution[hour] = (hourDistribution[hour] || 0) + 1;
    });

    const hourDistributionArray = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      count: hourDistribution[i] || 0,
    }));

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
            total: timeSeriesStats.length,
            topCocktail: topCocktailsWithNames.length > 0 ? { name: topCocktailsWithNames[0].name, count: topCocktailsWithNames[0].count } : null,
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
        timeSeries,
        topCocktails: topCocktailsWithNames,
        hourDistribution: hourDistributionArray,
      },
    });
  }),
});
