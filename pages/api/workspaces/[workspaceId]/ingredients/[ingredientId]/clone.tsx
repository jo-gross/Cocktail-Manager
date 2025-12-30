import { withHttpMethods } from '@middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { Role, Permission } from '@generated/prisma/client';
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../../../../prisma/prisma';

export default withHttpMethods({
  [HTTPMethod.POST]: withWorkspacePermission(
    [Role.MANAGER],
    Permission.INGREDIENTS_CREATE,
    async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
      const ingredientId = req.query.ingredientId as string | undefined;
      if (!ingredientId) return res.status(400).json({ message: 'No ingredient id' });
      const { name } = req.body;

      return prisma.$transaction(async (transaction) => {
        const existing = await transaction.ingredient.findFirst({
          where: {
            id: ingredientId,
            workspaceId: workspace.id,
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
        });

        if (!existing) return res.status(404).json({ message: 'Ingredient not found' });

        // Erstelle den neuen Ingredient
        const createData: any = {
          name: name,
          shortName: existing.shortName,
          notes: existing.notes,
          description: existing.description,
          price: existing.price,
          link: existing.link,
          tags: existing.tags,
          workspace: { connect: { id: workspace.id } },
        };

        const createClone = await transaction.ingredient.create({
          data: createData,
        });

        // Kopiere das Bild
        if (existing.IngredientImage && existing.IngredientImage.length > 0) {
          await transaction.ingredientImage.create({
            data: {
              ingredientId: createClone.id,
              image: existing.IngredientImage[0].image,
            },
          });
        }

        // Kopiere die Volumes
        if (existing.IngredientVolume && existing.IngredientVolume.length > 0) {
          for (const volume of existing.IngredientVolume) {
            await transaction.ingredientVolume.create({
              data: {
                unit: { connect: { id: volume.unitId } },
                ingredient: { connect: { id: createClone.id } },
                volume: volume.volume,
                workspace: { connect: { id: workspace.id } },
              },
            });
          }
        }

        return res.json({ data: createClone });
      });
    },
  ),
});
