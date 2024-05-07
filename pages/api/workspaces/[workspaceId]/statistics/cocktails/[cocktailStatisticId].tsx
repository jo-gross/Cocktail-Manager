import prisma from '../../../../../../prisma/prisma';
import { NextApiRequest, NextApiResponse } from 'next';
import HTTPMethod from 'http-method-enum';
import { withWorkspacePermission } from '../../../../../../middleware/api/authenticationMiddleware';
import { Role } from '@prisma/client';
import { withHttpMethods } from '../../../../../../middleware/api/handleMethods';

// DELETE /api/glasses/:id

export default withHttpMethods({
  [HTTPMethod.DELETE]: withWorkspacePermission([Role.MANAGER], async (req: NextApiRequest, res: NextApiResponse) => {
    const cocktailStatisticId = req.query.cocktailStatisticId as string | undefined;
    if (!cocktailStatisticId) return res.status(400).json({ message: 'No cocktail statistic id' });
    const result = await prisma.cocktailStatisticItem.delete({
      where: {
        id: cocktailStatisticId,
      },
    });
    return res.json({ data: result });
  }),
});
