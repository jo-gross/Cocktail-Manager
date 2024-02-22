import prisma from '../../../../../../lib/prisma';

import { NextApiRequest, NextApiResponse } from 'next';
import HTTPMethod from 'http-method-enum';
import { withWorkspacePermission } from '../../../../../../middleware/api/authenticationMiddleware';
import { Prisma, Role, Workspace } from '@prisma/client';
import { withHttpMethods } from '../../../../../../middleware/api/handleMethods';
import IngredientUpdateInput = Prisma.IngredientUpdateInput;

export default withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.USER], async (req: NextApiRequest, res: NextApiResponse) => {
    const ingredientId = req.query.ingredientId as string | undefined;
    if (!ingredientId) return res.status(400).json({ message: 'No ingredient id' });

    return res.json({
      data: await prisma.ingredient.findUnique({
        where: {
          id: ingredientId,
        },
        include: {
          IngredientImage: {
            select: {
              image: true,
            },
          },
        },
      }),
    });
  }),
  [HTTPMethod.PUT]: withWorkspacePermission([Role.MANAGER], async (req: NextApiRequest, res: NextApiResponse, user, workspace: Workspace) => {
    const { name, price, volume, unit, id, shortName, link, tags, image, notes } = req.body;

    const input: IngredientUpdateInput = {
      id: id,
      name: name,
      volume: volume,
      notes: notes,
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

    const result = await prisma.ingredient.update({
      where: {
        id: id,
      },
      data: input,
    });

    await prisma.ingredientImage.deleteMany({
      where: {
        ingredientId: id,
      },
    });

    if (image) {
      await prisma.ingredientImage.create({
        data: {
          ingredientId: id,
          image: image,
        },
      });
    }

    return res.json({ data: result });
  }),
  [HTTPMethod.DELETE]: withWorkspacePermission([Role.ADMIN], async (req: NextApiRequest, res: NextApiResponse) => {
    const ingredientId = req.query.ingredientId as string | undefined;
    if (!ingredientId) return res.status(400).json({ message: 'No ingredient id' });

    const result = await prisma.ingredient.delete({
      where: {
        id: ingredientId,
      },
    });
    return res.json({ data: result });
  }),
});
