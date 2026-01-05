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

    // Get all ingredients in the workspace
    const allIngredients = await prisma.ingredient.findMany({
      where: {
        workspaceId: workspace.id,
      },
      select: {
        id: true,
        name: true,
      },
    });

    // Get all cocktails with their ingredients to count cocktails per ingredient
    const cocktailsWithIngredients = await prisma.cocktailRecipe.findMany({
      where: {
        workspaceId: workspace.id,
      },
      select: {
        id: true,
        steps: {
          select: {
            ingredients: {
              select: {
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

    // Build a map of ingredient names to cocktail IDs
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

    // If date range is provided, calculate order counts
    let ingredientOrderCounts: Record<string, number> = {};
    let total = 0;

    if (startDate && endDate) {
      const start = getStartOfDay(new Date(startDate as string), dayStartTime);
      const end = getEndOfDay(new Date(endDate as string), dayStartTime);

      // Get all statistics in the period
      const stats = await prisma.cocktailStatisticItem.findMany({
        where: {
          workspaceId: workspace.id,
          date: {
            gte: start,
            lte: end,
          },
        },
        include: {
          cocktail: {
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
          },
        },
      });

      total = stats.length;

      // Count ingredient occurrences from orders
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

    // Convert to array with all ingredients, including those without orders
    const ingredientsWithStats = allIngredients
      .map((ingredient) => ({
        ingredient: ingredient.name,
        count: ingredientOrderCounts[ingredient.name] || 0,
        cocktailCount: ingredientCocktailMap[ingredient.name]?.size || 0,
        percentage: total > 0 ? ((ingredientOrderCounts[ingredient.name] || 0) / total) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count || a.ingredient.localeCompare(b.ingredient));

    return res.json({
      data: ingredientsWithStats,
      total,
    });
  }),
});
