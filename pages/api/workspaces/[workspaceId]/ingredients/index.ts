// pages/api/post/index.ts

import prisma from '../../../../../prisma/prisma';
import { NextApiRequest, NextApiResponse } from 'next';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { Prisma, Role, Workspace, Permission } from '@generated/prisma/client';
import { withHttpMethods } from '@middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';
import IngredientCreateInput = Prisma.IngredientCreateInput;

export default withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.USER], Permission.INGREDIENTS_READ, async (req: NextApiRequest, res: NextApiResponse, user, workspace: Workspace) => {
    const ingredients = await prisma.ingredient.findMany({
      where: {
        workspaceId: workspace.id,
      },
      include: {
        IngredientVolume: {
          include: {
            unit: true,
          },
        },
        _count: {
          select: {
            IngredientImage: true,
          },
        },
      },
    });
    return res.json({ data: ingredients });
  }),
  [HTTPMethod.POST]: withWorkspacePermission([Role.MANAGER], Permission.INGREDIENTS_CREATE, async (req: NextApiRequest, res: NextApiResponse, user, workspace: Workspace) => {
    try {
      await prisma.$transaction(async (transaction) => {
        const { name, price, shortName, link, tags, image, notes, description, units } = req.body;

        const input: IngredientCreateInput = {
          name: name,
          notes: notes,
          description: description,
          shortName: shortName,
          price: price,
          link: link,
          tags: tags,
          workspace: {
            connect: {
              id: workspace.id,
            },
          },
        };

        const result = await transaction.ingredient.create({
          data: input,
        });

        if (units) {
          for (const unit of units) {
            await transaction.ingredientVolume.create({
              data: {
                volume: unit.volume,
                unit: {
                  connect: {
                    id: unit.unitId,
                  },
                },
                ingredient: {
                  connect: {
                    id: result.id,
                  },
                },
                workspace: {
                  connect: {
                    id: workspace.id,
                  },
                },
              },
            });
          }
        }

        if (image) {
          const imageResult = await transaction.ingredientImage.create({
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
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ msg: 'Error' });
    }
  }),
});
