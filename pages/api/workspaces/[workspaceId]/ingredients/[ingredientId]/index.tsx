import prisma from '../../../../../../prisma/prisma';

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
          IngredientVolume: {
            include: {
              unit: true,
            },
          },
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
    try {
      await prisma.$transaction(async (transaction) => {
        const { name, price, id, shortName, link, tags, image, notes, description, units } = req.body;

        const input: IngredientUpdateInput = {
          id: id,
          name: name,
          shortName: shortName,
          notes: notes,
          description: description,
          price: price,
          link: link,
          tags: tags,
          workspace: {
            connect: {
              id: workspace.id,
            },
          },
        };

        const result = await transaction.ingredient.update({
          where: {
            id: id,
          },
          data: input,
        });

        await transaction.ingredientVolume.deleteMany({
          where: {
            ingredientId: id,
          },
        });

        await transaction.ingredientImage.deleteMany({
          where: {
            ingredientId: id,
          },
        });

        if (image) {
          await transaction.ingredientImage.create({
            data: {
              ingredientId: id,
              image: image,
            },
          });
        }

        if (units) {
          for (const unit of units) {
            await transaction.ingredientVolume.create({
              data: {
                unit: { connect: { id: unit.unitId } },
                ingredient: {
                  connect: {
                    id: result.id,
                  },
                },
                volume: unit.volume,
                workspace: {
                  connect: {
                    id: workspace.id,
                  },
                },
              },
            });
          }
        }

        return res.json({ data: result });
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ msg: 'Error' });
    }
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
