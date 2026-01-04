import prisma from '../../../../../../../prisma/prisma';
import { NextApiRequest, NextApiResponse } from 'next';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { Role, Permission } from '@generated/prisma/client';
import HTTPMethod from 'http-method-enum';
import '../../../../../../../lib/DateUtils';
import { getStartOfDay, getEndOfDay } from '../../../../../../../lib/dateHelpers';

export default withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.USER], Permission.STATISTICS_READ, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const { startDate, endDate } = req.query;

    // Get all unique tags from all cocktails in the workspace
    const allCocktails = await prisma.cocktailRecipe.findMany({
      where: {
        workspaceId: workspace.id,
      },
      select: {
        id: true,
        tags: true,
      },
    });

    // Build a map of all tags with their cocktail associations
    const allTags: Record<string, Set<string>> = {};
    allCocktails.forEach((cocktail) => {
      (cocktail.tags || []).forEach((tag) => {
        if (!allTags[tag]) {
          allTags[tag] = new Set();
        }
        allTags[tag].add(cocktail.id);
      });
    });

    // If date range is provided, calculate order counts
    let tagCounts: Record<string, number> = {};
    let total = 0;

    if (startDate && endDate) {
      const start = getStartOfDay(new Date(startDate as string));
      const end = getEndOfDay(new Date(endDate as string));

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
            select: {
              tags: true,
            },
          },
        },
      });

      total = stats.length;

      // Count tag occurrences from orders
      stats.forEach((stat) => {
        const tags = stat.cocktail.tags || [];
        tags.forEach((tag) => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      });
    }

    // Convert to array with all tags, including those without orders
    const tagsWithStats = Object.entries(allTags)
      .map(([tag, cocktailIds]) => ({
        tag,
        count: tagCounts[tag] || 0,
        cocktailCount: cocktailIds.size,
        percentage: total > 0 ? ((tagCounts[tag] || 0) / total) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));

    return res.json({
      data: tagsWithStats,
      total,
    });
  }),
});
