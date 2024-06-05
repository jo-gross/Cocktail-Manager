// pages/api/post/index.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { withWorkspacePermission } from '../../../../../middleware/api/authenticationMiddleware';
import { withHttpMethods } from '../../../../../middleware/api/handleMethods';
import { CocktailQueue, Role } from '@prisma/client';
import HTTPMethod from 'http-method-enum';
import prisma from '../../../../../prisma/prisma';

export default withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.USER], async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    // @ts-ignore
    const cocktailQueue: CocktailQueue[] = await prisma.cocktailQueue.groupBy({
      by: 'cocktailId',
      _count: {
        cocktailId: true,
      },
      where: {
        workspaceId: workspace.id,
      },
    });

    const cocktailQueueWithCocktail: { cocktailRecipe: any; count: number }[] = await Promise.all(
      cocktailQueue.map(async (queueItem) => {
        const cocktailRecipe = await prisma.cocktailRecipe.findUnique({ where: { id: queueItem.cocktailId } });

        return {
          cocktailRecipe: cocktailRecipe,
          // @ts-ignore
          count: queueItem._count.cocktailId,
        };
      }),
    );
    return res.json({ data: cocktailQueueWithCocktail });
  }),
});
