// pages/api/post/index.ts

import prisma from '../../../../../prisma/prisma';
import { NextApiRequest, NextApiResponse } from 'next';
import { withHttpMethods } from '@middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { Permission, Prisma, Role } from '@generated/prisma/client';
import GarnishCreateInput = Prisma.GarnishCreateInput;

export default withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.USER], Permission.GARNISHES_READ, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const garnishes = await prisma.garnish.findMany({
      where: {
        workspaceId: workspace.id,
      },
      include: {
        _count: { select: { GarnishImage: true } },
      },
    });
    return res.json({ data: garnishes });
  }),
  [HTTPMethod.POST]: withWorkspacePermission(
    [Role.MANAGER],
    Permission.GARNISHES_CREATE,
    async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
      const { name, price, id, image, description, notes } = req.body;

      const input: GarnishCreateInput = {
        id: id,
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

      const result = await prisma.garnish.create({
        data: input,
      });

      if (image) {
        const imageResult = await prisma.garnishImage.create({
          data: {
            image: image,
            garnish: {
              connect: {
                id: result.id,
              },
            },
          },
        });
      }

      return res.json({ data: result });
    },
  ),
});
