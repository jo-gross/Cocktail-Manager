// pages/api/post/index.ts

import prisma from '../../../../../../prisma/prisma';
import { NextApiRequest, NextApiResponse } from 'next';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { Permission, Role, WorkspaceSettingKey } from '@generated/prisma/client';
import HTTPMethod from 'http-method-enum';
import { CocktailStatisticItemFull } from '../../../../../../models/CocktailStatisticItemFull';
import '../../../../../../lib/DateUtils';
import { getEndOfDay, getStartOfDay } from '../../../../../../lib/dateHelpers';

export default withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.USER], Permission.STATISTICS_READ, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const { startDate, endDate, page, limit, search } = req.query;

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

    // Parse pagination parameters
    const pageNumber = page ? parseInt(page as string, 10) : 1;
    const pageSize = limit ? parseInt(limit as string, 10) : 50;

    // Build where clause
    const where: any = {
      workspaceId: workspace.id,
    };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = getStartOfDay(new Date(startDate as string), dayStartTime);
      }
      if (endDate) {
        where.date.lte = getEndOfDay(new Date(endDate as string), dayStartTime);
      }
    }

    // Add search filter (server-side)
    const searchTerm = search && typeof search === 'string' ? search.trim().toLowerCase() : null;

    if (searchTerm) {
      where.OR = [
        { cocktail: { name: { contains: searchTerm, mode: 'insensitive' } } },
        { cocktailCard: { name: { contains: searchTerm, mode: 'insensitive' } } },
        { user: { name: { contains: searchTerm, mode: 'insensitive' } } },
      ];
    }

    // Get total count for pagination (with search filter applied)
    const total = await prisma.cocktailStatisticItem.count({
      where,
    });

    const totalPages = Math.ceil(total / pageSize);
    const skip = (pageNumber - 1) * pageSize;
    const take = pageSize;

    // Get paginated results
    const cocktailStatistics: CocktailStatisticItemFull[] = await prisma.cocktailStatisticItem.findMany({
      where,
      include: {
        user: true,
        cocktail: true,
        cocktailCard: true,
      },
      orderBy: {
        date: 'desc',
      },
      skip,
      take,
    });

    return res.json({
      data: cocktailStatistics,
      pagination: {
        page: pageNumber,
        limit: pageSize,
        total,
        totalPages,
      },
    });
  }),
});
