import prisma from '../../../../../lib/prisma';
import { NextApiRequest, NextApiResponse } from 'next';

// DELETE /api/cocktails/:id

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  const workspaceId = req.query.workspaceId as string | undefined;
  if (!workspaceId) return res.status(400).json({ message: 'No workspace id' });
  const cocktailId = req.query.cocktailId as string | undefined;
  if (!cocktailId) return res.status(400).json({ message: 'No cocktail id' });

  if (req.method === 'GET') {
    return res.json(
      await prisma.cocktailRecipe.findFirst({
        where: {
          id: cocktailId,
          workspaceId: workspaceId,
        },
        include: {
          glass: true,
          garnishes: {
            include: {
              garnish: true,
            },
          },
          steps: {
            include: {
              ingredients: {
                include: {
                  ingredient: true,
                },
              },
            },
          },
        },
      }),
    );
  } else if (req.method === 'DELETE') {
    const cocktailRecipeIngredients = await prisma.cocktailRecipeIngredient.deleteMany({
      where: {
        cocktailRecipeStep: {
          cocktailRecipeId: cocktailId,
        },
      },
    });
    const cocktailRecipeSteps = await prisma.cocktailRecipeStep.deleteMany({
      where: {
        cocktailRecipeId: cocktailId,
      },
    });
    const result = await prisma.cocktailRecipe.delete({
      where: {
        id: cocktailId,
      },
    });
    return res.json(result);
  } else {
    throw new Error(`The HTTP ${req.method} method is not supported at this route.`);
  }
}
