import { withHttpMethods } from '../../../../../../middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';
import { withWorkspacePermission } from '../../../../../../middleware/api/authenticationMiddleware';
import { Role } from '@prisma/client';
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../../../../lib/prisma';

export default withHttpMethods({
  [HTTPMethod.PUT]: withWorkspacePermission([Role.MANAGER], async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const { cardId } = req.query;

    if (!cardId) return res.status(400).json({ message: 'No card id' });

    const result = await prisma.cocktailCard.update({
      where: {
        id: cardId as string,
      },
      data: {
        archived: false,
      },
    });

    return res.status(200).json({ data: result });
  }),
});
