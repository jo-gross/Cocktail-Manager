// pages/api/post/index.ts

import prisma from '../../../../../../prisma/prisma';
import { NextApiRequest, NextApiResponse } from 'next';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { Role, Permission, Prisma, WorkspaceSettingKey } from '@generated/prisma/client';
import HTTPMethod from 'http-method-enum';
import { CocktailStatisticItemFull } from '../../../../../../models/CocktailStatisticItemFull';
import { getStartOfDay, getEndOfDay } from '../../../../../../lib/dateHelpers';

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

    // Build where clause with dayStartTime support
    const where: Prisma.CocktailStatisticItemWhereInput = {
      workspaceId: workspace.id,
    };

    if (startDate || endDate) {
      const dateFilter: Prisma.DateTimeFilter = {};
      if (startDate) {
        dateFilter.gte = getStartOfDay(new Date(startDate as string), dayStartTime);
      }
      if (endDate) {
        dateFilter.lte = getEndOfDay(new Date(endDate as string), dayStartTime);
      }
      where.date = dateFilter;
    }

    const cocktailStatistics: CocktailStatisticItemFull[] = await prisma.cocktailStatisticItem.findMany({
      where,
      include: {
        user: true,
        cocktail: true,
        cocktailCard: true,
      },
    });
    return res.json({ data: cocktailStatistics });
  }),
});
