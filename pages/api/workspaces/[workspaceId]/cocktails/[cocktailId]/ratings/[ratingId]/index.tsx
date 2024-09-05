// pages/api/post/index.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { Role } from '@prisma/client';
import HTTPMethod from 'http-method-enum';
import { withHttpMethods } from '../../../../../../../../middleware/api/handleMethods';
import { withWorkspacePermission } from '../../../../../../../../middleware/api/authenticationMiddleware';
import prisma from '../../../../../../../../prisma/prisma';

export default withHttpMethods({
  [HTTPMethod.DELETE]: withWorkspacePermission([Role.MANAGER], async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const { cocktailId, ratingId } = req.query;
    const deleteResult = await prisma.cocktailRating.delete({
      where: {
        id: ratingId as string,
      },
    });

    return res.json({ data: deleteResult });
  }),
});
