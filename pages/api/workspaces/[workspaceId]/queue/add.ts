import HTTPMethod from 'http-method-enum';
import { withWorkspacePermission } from '../../../../../middleware/api/authenticationMiddleware';
import { Prisma, Role } from '@prisma/client';
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../../../lib/prisma';
import { withHttpMethods } from '../../../../../middleware/api/handleMethods';
import CocktailQueueCreateInput = Prisma.CocktailQueueCreateInput;

export default withHttpMethods({
  [HTTPMethod.POST]: withWorkspacePermission([Role.USER], async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const { cocktailId } = req.body;

    const input: CocktailQueueCreateInput = {
      workspace: {
        connect: {
          id: workspace.id,
        },
      },
      cocktail: {
        connect: {
          id: cocktailId,
        },
      },
    };
    const result = await prisma.cocktailQueue.create({
      data: input,
    });
    return res.json({ data: result });
  }),
});
