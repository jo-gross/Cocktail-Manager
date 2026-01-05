import prisma from '../../../../../../../../prisma/prisma';
import { NextApiRequest, NextApiResponse } from 'next';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { Role, Permission, WorkspaceSettingKey } from '@generated/prisma/client';
import HTTPMethod from 'http-method-enum';
import '../../../../../../../../lib/DateUtils';
import { getStartOfDay, getEndOfDay } from '../../../../../../../../lib/dateHelpers';

export default withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.USER], Permission.STATISTICS_READ, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const { setId, startDate, endDate } = req.query;

    if (!setId) {
      return res.status(400).json({ message: 'setId is required' });
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

    // Get set
    const set = await prisma.statisticSavedSet.findFirst({
      where: {
        id: setId as string,
        workspaceId: workspace.id,
      },
    });

    if (!set) {
      return res.status(404).json({ message: 'Set not found' });
    }

    const items = set.items as string[];

    // Determine date range
    let start: Date;
    let end: Date;

    if (startDate && endDate) {
      start = getStartOfDay(new Date(startDate as string), dayStartTime);
      end = getEndOfDay(new Date(endDate as string), dayStartTime);
    } else {
      // Use all time
      start = new Date(0);
      end = new Date();
    }

    // Get cocktails matching the set
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
      // Find cocktails that contain these ingredients
      const cocktails = await prisma.cocktailRecipe.findMany({
        where: {
          workspaceId: workspace.id,
          steps: {
            some: {
              ingredients: {
                some: {
                  ingredient: {
                    name: {
                      in: items,
                    },
                  },
                },
              },
            },
          },
        },
        select: { id: true },
      });
      matchingCocktailIds = cocktails.map((c) => c.id);
    }

    // Get statistics for matching cocktails
    const stats = await prisma.cocktailStatisticItem.findMany({
      where: {
        workspaceId: workspace.id,
        cocktailId: {
          in: matchingCocktailIds,
        },
        date: {
          gte: start,
          lte: end,
        },
      },
    });

    const total = stats.length;

    // Get total statistics for percentage
    const allStats = await prisma.cocktailStatisticItem.findMany({
      where: {
        workspaceId: workspace.id,
        date: {
          gte: start,
          lte: end,
        },
      },
    });

    const percentage = allStats.length > 0 ? (total / allStats.length) * 100 : 0;

    // Get total unique cocktails in the period
    const uniqueCocktailIdsInPeriod = new Set(allStats.map((stat) => stat.cocktailId));
    const totalUniqueCocktailsInPeriod = uniqueCocktailIdsInPeriod.size;

    // Calculate percentage of matching cocktails vs total unique cocktails in period
    const cocktailPercentage = totalUniqueCocktailsInPeriod > 0 ? (matchingCocktailIds.length / totalUniqueCocktailsInPeriod) * 100 : 0;

    // Get total number of all cocktails in the workspace (for percentage calculation)
    const totalCocktailsInWorkspace = await prisma.cocktailRecipe.count({
      where: {
        workspaceId: workspace.id,
      },
    });

    // Calculate percentage of matching cocktails vs all cocktails in workspace
    const cocktailPercentageAll = totalCocktailsInWorkspace > 0 ? (matchingCocktailIds.length / totalCocktailsInWorkspace) * 100 : 0;

    // Get cocktail details
    const cocktails = await prisma.cocktailRecipe.findMany({
      where: {
        id: {
          in: matchingCocktailIds,
        },
      },
      select: {
        id: true,
        name: true,
      },
    });

    // Count per cocktail
    const cocktailCounts: Record<string, number> = {};
    stats.forEach((stat) => {
      cocktailCounts[stat.cocktailId] = (cocktailCounts[stat.cocktailId] || 0) + 1;
    });

    const cocktailsWithCounts = cocktails
      .map((cocktail) => ({
        cocktailId: cocktail.id,
        name: cocktail.name,
        count: cocktailCounts[cocktail.id] || 0,
      }))
      .sort((a, b) => b.count - a.count);

    // For tag sets, aggregate ingredients; for ingredient sets, aggregate tags
    let aggregatedData: Array<{ name: string; count: number }> = [];

    if (set.type === 'TAG_SET') {
      // Aggregate ingredients from cocktails in this tag set
      const ingredientCounts: Record<string, number> = {};
      const cocktailsWithIngredients = await prisma.cocktailRecipe.findMany({
        where: {
          id: {
            in: matchingCocktailIds,
          },
        },
        include: {
          steps: {
            include: {
              ingredients: {
                include: {
                  ingredient: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
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
      // Aggregate tags from cocktails in this ingredient set
      const tagCounts: Record<string, number> = {};
      const cocktailsWithTags = await prisma.cocktailRecipe.findMany({
        where: {
          id: {
            in: matchingCocktailIds,
          },
        },
        select: {
          tags: true,
        },
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

    return res.json({
      data: {
        set: {
          id: set.id,
          name: set.name,
          type: set.type,
          logic: set.logic,
          items: set.items, // Include items in response
        },
        kpis: {
          total,
          percentage,
          cocktailCount: matchingCocktailIds.length, // Anzahl übereinstimmender Cocktails
          totalStats: allStats.length, // Gesamtanzahl der Bestellungen im Zeitraum
          totalUniqueCocktailsInPeriod: totalUniqueCocktailsInPeriod, // Anzahl unterschiedlicher Cocktails im Zeitraum
          cocktailPercentage: cocktailPercentage, // Prozentualer Anteil der übereinstimmenden Cocktails im Zeitraum
          totalCocktailsInWorkspace: totalCocktailsInWorkspace, // Gesamtanzahl aller Cocktails im Workspace
          cocktailPercentageAll: cocktailPercentageAll, // Prozentualer Anteil der übereinstimmenden Cocktails von allen Cocktails
        },
        cocktails: cocktailsWithCounts,
        aggregated: aggregatedData,
      },
    });
  }),
});
