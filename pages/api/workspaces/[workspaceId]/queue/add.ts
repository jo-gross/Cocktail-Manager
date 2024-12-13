import HTTPMethod from 'http-method-enum';
import { withWorkspacePermission } from '../../../../../middleware/api/authenticationMiddleware';
import { Prisma, Role } from '@prisma/client';
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../../../prisma/prisma';
import { withHttpMethods } from '../../../../../middleware/api/handleMethods';
import CocktailQueueCreateInput = Prisma.CocktailQueueCreateInput;

export default withHttpMethods({
  [HTTPMethod.POST]: withWorkspacePermission([Role.USER], async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const { cocktailId, notes, amount } = req.body;

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
      notes: notes ? (notes.trim() == '' ? undefined : notes.trim()) : undefined,
    };

    const results = [];
    for (let i = 0; i < (amount ?? 1); i++) {
      const result = await prisma.cocktailQueue.create({
        data: input,
      });
      results.push(result);
    }

    return res.json({ data: results });
  }),
});
