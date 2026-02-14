import prisma from '../../../../../../prisma/prisma';
import { createLog } from '../../../../../../lib/auditLog';
import { NextApiRequest, NextApiResponse } from 'next';
import HTTPMethod from 'http-method-enum';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { Permission, Prisma, Role } from '@generated/prisma/client';
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
  [HTTPMethod.DELETE]: withWorkspacePermission(
    [Role.ADMIN],
    Permission.GARNISHES_DELETE,
    async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
      const garnishId = req.query.garnishId as string | undefined;
      if (!garnishId) return res.status(400).json({ message: 'No garnish id' });

      await prisma.$transaction(async (tx) => {
        const oldGarnish = await tx.garnish.findUnique({
          where: { id: garnishId },
          include: { GarnishImage: true },
        });

        await tx.garnish.delete({
          where: {
            id: garnishId,
            workspaceId: workspace.id,
          },
        });

        await createLog(tx, workspace.id, user.id, 'Garnish', garnishId, 'DELETE', oldGarnish, null);
      });

      return res.json({ data: { count: 1 } });
    },
  ),
  [HTTPMethod.PUT]: withWorkspacePermission([Role.MANAGER], Permission.GARNISHES_UPDATE, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const garnishId = req.query.garnishId as string | undefined;
    if (!garnishId) return res.status(400).json({ message: 'No garnish id' });

    const { name, price, image, description, notes } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      const oldGarnish = await tx.garnish.findUnique({
        where: { id: garnishId },
        include: { GarnishImage: true },
      });

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

      const updatedGarnish = await tx.garnish.update({
        where: {
          id: garnishId,
        },
        data: input,
      });

      await tx.garnishImage.deleteMany({
        where: {
          garnishId: garnishId,
        },
      });

      if (image) {
        await tx.garnishImage.create({
          data: {
            garnishId: garnishId,
            image: image,
          },
        });
      }

      const fullNewGarnish = await tx.garnish.findUnique({
        where: { id: garnishId },
        include: { GarnishImage: true },
      });

      await createLog(tx, workspace.id, user.id, 'Garnish', garnishId, 'UPDATE', oldGarnish, fullNewGarnish);

      return updatedGarnish;
    });

    return res.json({ dat: result });
  }),
});
