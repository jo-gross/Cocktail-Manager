// pages/api/post/index.ts

import prisma from '../../../../../prisma/prisma';
import { NextApiRequest, NextApiResponse } from 'next';
import { CocktailCardGroupItem, Prisma, Role } from '@generated/prisma/client';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import HTTPMethod from 'http-method-enum';
import { withHttpMethods } from '@middleware/api/handleMethods';
import CocktailCardCreateInput = Prisma.CocktailCardCreateInput;
import CocktailCardGroupItemCreateInput = Prisma.CocktailCardGroupItemCreateInput;

export default withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.USER], async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const { withArchived } = req.query;

    let archiveFilter;
    if (withArchived === 'true') {
      archiveFilter = {
        archived: {},
      };
    } else {
      archiveFilter = {
        archived: false,
      };
    }

    const result = await prisma.cocktailCard.findMany({
      where: {
        workspaceId: workspace.id,
        AND: archiveFilter,
      },
      include: {
        groups: {
          include: {
            items: true,
          },
        },
      },
    });
    return res.json({ data: result });
  }),
  [HTTPMethod.POST]: withWorkspacePermission([Role.MANAGER], async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const { name, date, groups } = req.body;
    const input: CocktailCardCreateInput = {
      name: name,
      date: date,
      workspace: { connect: { id: workspace.id } },
    };
    const result = await prisma.cocktailCard.create({
      data: input,
    });

    if (groups.length > 0) {
      await groups.forEach(async (group: any) => {
        const groupResult = await prisma.cocktailCardGroup.create({
          data: {
            id: group.id,
            name: group.name,
            groupNumber: group.groupNumber,
            groupPrice: group.groupPrice,
            cocktailCard: { connect: { id: result.id } },
          },
        });

        if (group.items.length > 0) {
          group.items.map(async (item: CocktailCardGroupItem) => {
            const input: CocktailCardGroupItemCreateInput = {
              cocktail: { connect: { id: item.cocktailId } },
              cocktailCardGroup: { connect: { id: groupResult.id } },
              itemNumber: item.itemNumber,
              specialPrice: item.specialPrice,
            };
            await prisma.cocktailCardGroupItem.create({
              data: input,
            });
          });
        }
      });
    }

    return res.json({ data: result });
  }),
});
