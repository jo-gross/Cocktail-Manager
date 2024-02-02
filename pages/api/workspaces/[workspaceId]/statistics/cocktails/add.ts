import HTTPMethod from 'http-method-enum';
import { withWorkspacePermission } from '../../../../../../middleware/api/authenticationMiddleware';
import { Prisma, Role } from '@prisma/client';
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../../../../lib/prisma';
import { withHttpMethods } from '../../../../../../middleware/api/handleMethods';
import CocktailStatisticItemCreateInput = Prisma.CocktailStatisticItemCreateInput;

export default withHttpMethods({
  [HTTPMethod.POST]: withWorkspacePermission([Role.USER], async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const { cocktailId, cocktailCardId, actionSource } = req.body;

    var cardId = cocktailCardId as string | undefined;
    if (cardId == 'search') {
      cardId = undefined;
    }
    const input: CocktailStatisticItemCreateInput = {
      date: new Date(),
      workspace: {
        connect: {
          id: workspace.id,
        },
      },
      user: {
        connect: {
          id: user.id,
        },
      },
      cocktail: {
        connect: {
          id: cocktailId,
        },
      },
      cocktailCard: cardId
        ? {
            connect: {
              id: cardId,
            },
          }
        : undefined,
      actionSource: actionSource,
    };
    const result = await prisma.cocktailStatisticItem.create({
      data: input,
    });
    return res.json({ data: result });
  }),
});
