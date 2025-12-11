import prisma from '../../../../../../prisma/prisma';
import { NextApiRequest, NextApiResponse } from 'next';
import HTTPMethod from 'http-method-enum';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { Prisma, Role, Permission } from '@generated/prisma/client';
import { withHttpMethods } from '@middleware/api/handleMethods';
import GarnishUpdateInput = Prisma.GarnishUpdateInput;

// DELETE /api/garnish/:id

export default withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.USER], Permission.GARNISHES_READ, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const garnishId = req.query.garnishId as string | undefined;
    if (!garnishId) return res.status(400).json({ message: 'No garnish id' });

    const result = await prisma.garnish.findUnique({
      where: {
        id: garnishId,
        workspaceId: workspace.id,
      },
      include: {
        GarnishImage: {
          select: {
            image: true,
          },
        },
      },
    });
    return res.json({ data: result });
  }),
  [HTTPMethod.DELETE]: withWorkspacePermission([Role.ADMIN], Permission.GARNISHES_DELETE, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const garnishId = req.query.garnishId as string | undefined;
    if (!garnishId) return res.status(400).json({ message: 'No garnish id' });

    const result = await prisma.garnish.delete({
      where: {
        id: garnishId,
        workspaceId: workspace.id,
      },
    });
    return res.json({ data: result });
  }),
  [HTTPMethod.PUT]: withWorkspacePermission([Role.MANAGER], Permission.GARNISHES_UPDATE, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const garnishId = req.query.garnishId as string | undefined;
    if (!garnishId) return res.status(400).json({ message: 'No garnish id' });

    const { name, price, image, description, notes } = req.body;

    const input: GarnishUpdateInput = {
      name: name,
      price: price,
      description: description,
      notes: notes,
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

    await prisma.garnishImage.deleteMany({
      where: {
        garnishId: garnishId,
      },
    });

    if (image) {
      await prisma.garnishImage.create({
        data: {
          garnishId: garnishId,
          image: image,
        },
      });
    }

    return res.json({ dat: result });
  }),
});
