// pages/api/post/index.ts

import prisma from '../../../../../lib/prisma';
import { Prisma } from '.prisma/client';
import { NextApiRequest, NextApiResponse } from 'next';
import { withHttpMethods } from '../../../../../middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';
import { withWorkspacePermission } from '../../../../../middleware/api/authenticationMiddleware';
import { Role } from '@prisma/client';
import GarnishCreateInput = Prisma.GarnishCreateInput;

export default withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.USER], async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const garnishes = await prisma.garnish.findMany({
      where: {
        workspaceId: workspace.id,
      },
    });
    return res.json({ data: garnishes });
  }),
  [HTTPMethod.POST]: withWorkspacePermission([Role.MANAGER], async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const { name, price, id, image, description } = req.body;

    const input: GarnishCreateInput = {
      id: id,
      name: name,
      price: price,
      description: description,
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

    return res.json(result);
  }),
});
