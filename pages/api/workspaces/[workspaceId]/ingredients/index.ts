// pages/api/post/index.ts

import prisma from '../../../../../lib/prisma';
import { Prisma } from '.prisma/client';
import { NextApiRequest, NextApiResponse } from 'next';
import { withWorkspacePermission } from '../../../../../middleware/authenticationMiddleware';
import IngredientCreateInput = Prisma.IngredientCreateInput;
import { Role, Workspace } from '@prisma/client';

export default withWorkspacePermission(
  [Role.USER],
  async (req: NextApiRequest, res: NextApiResponse, user, workspace: Workspace) => {
    if (req.method === 'GET') {
      const ingredients = await prisma.ingredient.findMany({
        where: {
          workspaceId: workspace.id,
        },
      });
      return res.json(ingredients);
    }

    const { name, price, volume, unit, id, shortName, link, tags, image } = req.body;

    const input: IngredientCreateInput = {
      id: id,
      name: name,
      volume: volume,
      shortName: shortName,
      unit: unit,
      price: price,
      link: link,
      tags: tags,
      image: image,
      workspace: {
        connect: {
          id: workspace.id,
        },
      },
    };
    if (req.method === 'PUT') {
      const result = await prisma.ingredient.update({
        where: {
          id: id,
        },
        data: input,
      });
      return res.json(result);
    } else if (req.method === 'POST') {
      const result = await prisma.ingredient.create({
        data: input,
      });
      return res.json(result);
    }
  },
);
