import { withHttpMethods } from '@middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { Role, Permission } from '@generated/prisma/client';
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../../../../prisma/prisma';

export default withHttpMethods({
  [HTTPMethod.POST]: withWorkspacePermission(
    [Role.MANAGER],
    Permission.GARNISHES_CREATE,
    async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
      const garnishId = req.query.garnishId as string | undefined;
      if (!garnishId) return res.status(400).json({ message: 'No garnish id' });
      const { name } = req.body;

      return prisma.$transaction(async (transaction) => {
        const existing = await transaction.garnish.findFirst({
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

        if (!existing) return res.status(404).json({ message: 'Garnish not found' });

        // Erstelle den neuen Garnish
        const createClone = await transaction.garnish.create({
          data: {
            name: name,
            price: existing.price,
            description: existing.description,
            notes: existing.notes,
            workspace: { connect: { id: workspace.id } },
          },
        });

        // Kopiere das Bild
        if (existing.GarnishImage && existing.GarnishImage.length > 0) {
          await transaction.garnishImage.create({
            data: {
              garnishId: createClone.id,
              image: existing.GarnishImage[0].image,
            },
          });
        }

        return res.json({ data: createClone });
      });
    },
  ),
});
