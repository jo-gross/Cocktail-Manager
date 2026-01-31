import prisma from '../../../../../../../../prisma/prisma';
import { NextApiRequest, NextApiResponse } from 'next';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { Role, Permission, WorkspaceSettingKey } from '@generated/prisma/client';
import HTTPMethod from 'http-method-enum';
import '../../../../../../../../lib/DateUtils';
import { formatDateLocal, getStartOfDay, getEndOfDay, getLogicalDate, getStartOfWeek } from '../../../../../../../../lib/dateHelpers';

function determineGranularity(startDate: Date, endDate: Date): 'hour' | 'day' | 'week' | 'month' {
  const diffMs = endDate.getTime() - startDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays <= 1) return 'hour';
  if (diffDays <= 7) return 'day';
  if (diffDays <= 90) return 'week';
  return 'month';
}

export default withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.USER], Permission.STATISTICS_READ, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const { cocktailId, startDate, endDate } = req.query;

    if (!cocktailId) {
      return res.status(400).json({ message: 'cocktailId is required' });
    }

    // Verify cocktail exists and belongs to workspace
    const cocktail = await prisma.cocktailRecipe.findFirst({
      where: {
        id: cocktailId as string,
        workspaceId: workspace.id,
      },
      select: {
        id: true,
        name: true,
        tags: true,
        price: true,
        steps: {
          include: {
            ingredients: {
              include: {
                ingredient: true,
              },
            },
          },
        },
      },
    });

    if (!cocktail) {
      return res.status(404).json({ message: 'Cocktail not found' });
    }

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

    // Determine date range
    let start: Date;
    let end: Date;

    if (startDate && endDate) {
      start = getStartOfDay(new Date(startDate as string), dayStartTime);
      end = getEndOfDay(new Date(endDate as string), dayStartTime);
    } else {
      // All-time: get first and last statistic
      const firstStat = await prisma.cocktailStatisticItem.findFirst({
        where: {
          workspaceId: workspace.id,
          cocktailId: cocktailId as string,
        },
        orderBy: {
          date: 'asc',
        },
      });

      const lastStat = await prisma.cocktailStatisticItem.findFirst({
        where: {
          workspaceId: workspace.id,
          cocktailId: cocktailId as string,
        },
        orderBy: {
          date: 'desc',
        },
      });

      if (!firstStat) {
        return res.json({
          data: {
            cocktail: {
              id: cocktail.id,
              name: cocktail.name,
              tags: cocktail.tags,
            },
            total: 0,
            avgPerActiveHour: 0,
            rank: 0,
            delta: 0,
            timeSeries: [],
            hourDistribution: [],
            dayDistribution: [],
            ingredients: [],
          },
        });
      }

      start = getStartOfDay(firstStat.date, dayStartTime);
      end = lastStat ? getEndOfDay(lastStat.date, dayStartTime) : getEndOfDay(new Date(), dayStartTime);
    }

    // Calculate previous period for comparison
    const periodLength = end.getTime() - start.getTime();
    const previousEnd = new Date(start);
    previousEnd.setTime(previousEnd.getTime() - 1);
    const previousStart = new Date(previousEnd);
    previousStart.setTime(previousStart.getTime() - periodLength);

    // Get statistics for current period
    const currentStats = await prisma.cocktailStatisticItem.findMany({
      where: {
        workspaceId: workspace.id,
        cocktailId: cocktailId as string,
        date: {
          gte: start,
          lte: end,
        },
      },
      orderBy: {
        date: 'asc',
      },
    });

    // Get statistics for previous period
    const previousStats = await prisma.cocktailStatisticItem.findMany({
      where: {
        workspaceId: workspace.id,
        cocktailId: cocktailId as string,
        date: {
          gte: previousStart,
          lte: previousEnd,
        },
      },
    });

    const total = currentStats.length;
    const previousTotal = previousStats.length;
    const delta = previousTotal > 0 ? ((total - previousTotal) / previousTotal) * 100 : total > 0 ? 100 : 0;

    // Calculate average per active hour (use logical date so hours before dayStartTime count on previous day)
    const activeHours = new Set<string>();
    currentStats.forEach((stat) => {
      const date = new Date(stat.date);
      const logicalDate = getLogicalDate(date, dayStartTime);
      const hourKey = `${formatDateLocal(logicalDate)}_${date.getHours()}`;
      activeHours.add(hourKey);
    });
    const avgPerActiveHour = activeHours.size > 0 ? total / activeHours.size : 0;

    // Get rank in current period
    const allCocktailStats = await prisma.cocktailStatisticItem.groupBy({
      by: ['cocktailId'],
      where: {
        workspaceId: workspace.id,
        date: {
          gte: start,
          lte: end,
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
    });

    const rank = allCocktailStats.findIndex((stat) => stat.cocktailId === cocktailId) + 1;

    // Time series data: group by logical day (respecting dayStartTime) so orders before dayStartTime count on previous day
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

    // Hour distribution (0-23)
    const hourDistribution: Record<number, number> = {};
    currentStats.forEach((stat) => {
      const hour = new Date(stat.date).getHours();
      hourDistribution[hour] = (hourDistribution[hour] || 0) + 1;
    });

    const hourDistributionArray = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      count: hourDistribution[i] || 0,
    }));

    // Day distribution (0 = Sunday, 1 = Monday, etc.)
    // Use logical date based on dayStartTime to correctly assign orders to days
    const dayDistribution: Record<number, number> = {};
    currentStats.forEach((stat) => {
      const logicalDate = getLogicalDate(new Date(stat.date), dayStartTime);
      const day = logicalDate.getDay();
      dayDistribution[day] = (dayDistribution[day] || 0) + 1;
    });

    const dayDistributionArray = Array.from({ length: 7 }, (_, i) => ({
      day: i,
      count: dayDistribution[i] || 0,
    }));

    // Get ingredients from cocktail
    const ingredients = new Set<string>();
    cocktail.steps.forEach((step) => {
      step.ingredients.forEach((ing) => {
        if (ing.ingredient) {
          ingredients.add(ing.ingredient.name);
        }
      });
    });

    // Calculate revenue
    const revenue = total * (cocktail.price || 0);
    const previousRevenue = previousTotal * (cocktail.price || 0);

    return res.json({
      data: {
        cocktail: {
          id: cocktail.id,
          name: cocktail.name,
          tags: cocktail.tags,
          price: cocktail.price || 0,
        },
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
    });
  }),
});
