import prisma from '../../../../../../../prisma/prisma';
import { NextApiRequest, NextApiResponse } from 'next';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { Role, Permission, WorkspaceSettingKey } from '@generated/prisma/client';
import HTTPMethod from 'http-method-enum';
import '../../../../../../../lib/DateUtils';
import { getStartOfDay, getEndOfDay } from '../../../../../../../lib/dateHelpers';

export default withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.USER], Permission.STATISTICS_READ, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'startDate and endDate are required' });
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

    const start = getStartOfDay(new Date(startDate as string), dayStartTime);
    const end = getEndOfDay(new Date(endDate as string), dayStartTime);

    // Calculate previous period for comparison
    const periodLength = end.getTime() - start.getTime();
    const previousEnd = new Date(start);
    previousEnd.setTime(previousEnd.getTime() - 1);
    const previousStart = new Date(previousEnd);
    previousStart.setTime(previousStart.getTime() - periodLength);

    // Get statistics for current period
    const currentStats = await prisma.cocktailStatisticItem.groupBy({
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
    });

    // Get statistics for previous period
    const previousStats = await prisma.cocktailStatisticItem.groupBy({
      by: ['cocktailId'],
      where: {
        workspaceId: workspace.id,
        date: {
          gte: previousStart,
          lte: previousEnd,
        },
      },
      _count: {
        cocktailId: true,
      },
    });

    // Calculate total for percentage
    const totalCurrent = currentStats.reduce((sum, stat) => sum + stat._count.cocktailId, 0);

    // Create maps for quick lookup
    const previousMap = new Map(previousStats.map((stat) => [stat.cocktailId, stat._count.cocktailId]));

    // Get cocktail details with ingredients and calculate rankings
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
                      select: {
                        id: true,
                        name: true,
                        price: true,
                        IngredientVolume: {
                          include: {
                            unit: true,
                          },
                        },
                      },
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

        // Extract ingredients with amounts and price
        const ingredients = cocktail.steps.flatMap((step) =>
          step.ingredients
            .filter((ing) => ing.ingredient != null && ing.unit != null)
            .map((ing) => ({
              ingredientId: ing.ingredient!.id,
              ingredientName: ing.ingredient!.name,
              ingredientPrice: ing.ingredient!.price || 0, // Ingredient price for cost calculation
              amount: ing.amount || 0,
              unitId: ing.unit!.id,
              unitName: ing.unit!.name,
              availableUnits: ing.ingredient!.IngredientVolume.map((iv) => ({
                unitId: iv.unitId,
                unitName: iv.unit.name,
                volume: iv.volume,
              })),
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

    // Filter out nulls and sort by count descending
    const filtered = cocktailsWithStats.filter((c): c is NonNullable<typeof c> => c !== null);
    filtered.sort((a, b) => b.count - a.count);

    // Add ranking
    const withRanking = filtered.map((cocktail, index) => ({
      ...cocktail,
      rank: index + 1,
    }));

    return res.json({
      data: withRanking,
      total: totalCurrent,
    });
  }),
});
