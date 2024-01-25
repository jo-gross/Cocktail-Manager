import prisma from '../../../../../lib/prisma';
import { NextApiRequest, NextApiResponse } from 'next';
import HTTPMethod from 'http-method-enum';
import { withWorkspacePermission } from '../../../../../middleware/api/authenticationMiddleware';
import { Prisma, Role } from '@prisma/client';
import { withHttpMethods } from '../../../../../middleware/api/handleMethods';
import GarnishUpdateInput = Prisma.GarnishUpdateInput;

// DELETE /api/garnish/:id

export default withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.USER], async (req: NextApiRequest, res: NextApiResponse) => {
    const garnishId = req.query.garnishId as string | undefined;
    if (!garnishId) return res.status(400).json({ message: 'No garnish id' });

    const result = await prisma.garnish.findUnique({
      where: {
        id: garnishId,
      },
    });
    return res.json({ data: result });
  }),
  [HTTPMethod.DELETE]: withWorkspacePermission([Role.ADMIN], async (req: NextApiRequest, res: NextApiResponse) => {
    const garnishId = req.query.garnishId as string | undefined;
    if (!garnishId) return res.status(400).json({ message: 'No garnish id' });

    const result = await prisma.garnish.delete({
      where: {
        id: garnishId,
      },
    });
    return res.json({ data: result });
  }),
  [HTTPMethod.PUT]: withWorkspacePermission([Role.MANAGER], async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const garnishId = req.query.garnishId as string | undefined;
    if (!garnishId) return res.status(400).json({ message: 'No garnish id' });

    const { name, price, image, description } = req.body;

    const input: GarnishUpdateInput = {
      name: name,
      price: price,
      image: image,
      description: description,
      workspace: {
        connect: {
          id: workspace.id,
        },
      },
    };
    const result = await prisma.garnish.update({
      where: {
        id: garnishId,
      },
      data: input,
    });
    return res.json({ dat: result });
  }),
});
