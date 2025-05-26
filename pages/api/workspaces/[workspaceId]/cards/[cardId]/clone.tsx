import { withHttpMethods } from '@middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { Role } from '@generated/prisma/client';
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../../../../prisma/prisma';

export default withHttpMethods({
  [HTTPMethod.POST]: withWorkspacePermission([Role.MANAGER], async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const cardId = req.query.cardId as string | undefined;
    if (!cardId) return res.status(400).json({ message: 'No card id' });
    const { name } = JSON.parse(req.body);

    return prisma.$transaction(async (transaction) => {
      const existing = await prisma.cocktailCard.findFirst({
        where: {
          id: cardId,
          workspaceId: workspace.id,
        },
      });
      if (!existing) return res.status(404).json({ message: 'Card not found' });

      const createClone = await transaction.cocktailCard.create({
        data: {
          id: undefined,
          name: name,
          createdAt: undefined,
          updatedAt: undefined,
          workspaceId: workspace.id,
          date: existing.date,
          archived: existing.archived,
        },
      });

      const groups = await prisma.cocktailCardGroup.findMany({
        where: {
          cocktailCardId: existing.id,
        },
        include: {
          items: true,
        },
      });

      for (const group of groups) {
        const createGroup = await transaction.cocktailCardGroup.create({
          data: {
            id: undefined,
            name: group.name,
            groupNumber: group.groupNumber,
            groupPrice: group.groupPrice,
            items: {},
            cocktailCard: { connect: { id: createClone.id } },
          },
        });

        for (const item of group.items) {
          await transaction.cocktailCardGroupItem.create({
            data: {
              itemNumber: item.itemNumber,
              specialPrice: item.specialPrice,
              cocktailCardGroup: { connect: { id: createGroup.id } },
              cocktail: { connect: { id: item.cocktailId } },
            },
          });
        }
      }

      return res.json({ data: createClone });
    });
  }),
});
