import prisma from '../../../../../../prisma/prisma';
import { NextApiRequest, NextApiResponse } from 'next';
import HTTPMethod from 'http-method-enum';
import { withWorkspacePermission } from '../../../../../../middleware/api/authenticationMiddleware';
import { Prisma, Role } from '@prisma/client';
import { withHttpMethods } from '../../../../../../middleware/api/handleMethods';

// DELETE /api/glasses/:id

export default withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.USER], async (req: NextApiRequest, res: NextApiResponse) => {
    const iceId = req.query.iceId as string | undefined;
    if (!iceId) return res.status(400).json({ message: 'No ice id' });

    const result = await prisma.ice.findUnique({
      where: {
        id: iceId,
      },
    });
    return res.json({ data: result });
  }),
  [HTTPMethod.DELETE]: withWorkspacePermission([Role.ADMIN], async (req: NextApiRequest, res: NextApiResponse) => {
    const iceId = req.query.iceId as string | undefined;
    if (!iceId) return res.status(400).json({ message: 'No ice id' });
    const result = await prisma.ice.delete({
      where: {
        id: iceId,
      },
    });
    return res.json({ data: result });
  }),
});
