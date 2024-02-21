// pages/api/post/index.ts

import prisma from '../../../../../lib/prisma';
import { Prisma } from '.prisma/client';
import { NextApiRequest, NextApiResponse } from 'next';
import { withWorkspacePermission } from '../../../../../middleware/api/authenticationMiddleware';
import { Role, Workspace } from '@prisma/client';
import { withHttpMethods } from '../../../../../middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';
import IngredientCreateInput = Prisma.IngredientCreateInput;

export default withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.USER], async (req: NextApiRequest, res: NextApiResponse, user, workspace: Workspace) => {
    const ingredients = await prisma.ingredient.findMany({
      where: {
        workspaceId: workspace.id,
      },
      include: {
        _count: {
          select: {
            IngredientImage: true,
          },
        },
      },
    });
    return res.json({ data: ingredients });
  }),
  [HTTPMethod.POST]: withWorkspacePermission([Role.MANAGER], async (req: NextApiRequest, res: NextApiResponse, user, workspace: Workspace) => {
    const { name, price, volume, unit, shortName, link, tags, image } = req.body;

    const input: IngredientCreateInput = {
      name: name,
      volume: volume,
      shortName: shortName,
      unit: unit,
      price: price,
      link: link,
      tags: tags,
      workspace: {
        connect: {
          id: workspace.id,
        },
      },
    };

    const result = await prisma.ingredient.create({
      data: input,
    });

    if (image) {
      const imageResult = await prisma.ingredientImage.create({
        data: {
          image: image,
          ingredient: {
            connect: {
              id: result.id,
            },
          },
        },
      });
    }
    return res.json({ data: result });
  }),
});
