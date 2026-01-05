import prisma from '../../../../../../../prisma/prisma';
import { NextApiRequest, NextApiResponse } from 'next';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { Role, Permission, WorkspaceSettingKey } from '@generated/prisma/client';
import HTTPMethod from 'http-method-enum';
import { getStartOfDay, getEndOfDay } from '../../../../../../../lib/dateHelpers';

export default withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.USER], Permission.STATISTICS_READ, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const { startDate, endDate } = req.query;

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

    // Get all cocktails in the workspace
    const allCocktails = await prisma.cocktailRecipe.findMany({
      where: {
        workspaceId: workspace.id,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    // If date range is provided, calculate order counts
    let cocktailOrderCounts: Record<string, number> = {};
    let total = 0;

    if (startDate && endDate) {
      const start = getStartOfDay(new Date(startDate as string), dayStartTime);
      const end = getEndOfDay(new Date(endDate as string), dayStartTime);

      // Get all statistics in the period
      const stats = await prisma.cocktailStatisticItem.groupBy({
        by: ['cocktailId'],
        where: {
          workspaceId: workspace.id,
          date: {
            gte: start,
            lte: end,
          },
        },
        _count: {
          id: true,
        },
      });

      stats.forEach((stat) => {
        cocktailOrderCounts[stat.cocktailId] = stat._count.id;
        total += stat._count.id;
      });
    }

    // Convert to array with all cocktails, including those without orders
    const cocktailsWithStats = allCocktails.map((cocktail) => ({
      id: cocktail.id,
      name: cocktail.name,
      count: cocktailOrderCounts[cocktail.id] || 0,
    }));

    return res.json({
      data: cocktailsWithStats,
      total,
    });
  }),
});
