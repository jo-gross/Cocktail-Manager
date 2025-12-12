// pages/api/post/index.ts

import prisma from '../../../../../../prisma/prisma';
import { NextApiRequest, NextApiResponse } from 'next';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { Role, Permission } from '@generated/prisma/client';
import HTTPMethod from 'http-method-enum';
import { CocktailStatisticItemFull } from '../../../../../../models/CocktailStatisticItemFull';
import '../../../../../../lib/DateUtils';

export default withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.USER], Permission.STATISTICS_READ, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const { startDate, endDate } = req.query;

    const cocktailStatistics: CocktailStatisticItemFull[] = await prisma.cocktailStatisticItem.findMany({
      where: {
        workspaceId: workspace.id,
        date: {
          gte: startDate ? new Date(new Date(startDate as string).setHours(8, 0, 0, 0)) : undefined,
          lte: endDate
            ? startDate != undefined && new Date(startDate as string).withoutTime().getTime() - new Date(endDate as string).withoutTime().getTime() == 0
              ? new Date(new Date(endDate as string).setHours(23, 59, 59, 999))
              : new Date(new Date(endDate as string).setHours(8, 0, 0, 0))
            : undefined,
        },
      },
      include: {
        user: true,
        cocktail: true,
        cocktailCard: true,
      },
    });
    return res.json({ data: cocktailStatistics });
  }),
});
