import prisma from '../../../lib/prisma';
import { NextApiRequest, NextApiResponse } from 'next';

// DELETE /api/cocktails/:id

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  const id = req.query.id as string | undefined;
  if (id == undefined) {
    return res.status(400).json({ message: 'id is undefined' });
  } else if (req.method === 'GET') {
    return res.json(
      await prisma.cocktailRecipe.findFirst({
        where: {
          id: id,
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
          cocktailRecipeId: id,
        },
      },
    });
    const cocktailRecipeSteps = await prisma.cocktailRecipeStep.deleteMany({
      where: {
        cocktailRecipeId: id,
      },
    });
    const result = await prisma.cocktailRecipe.delete({
      where: {
        id: id,
      },
    });
    return res.json(result);
  } else {
    throw new Error(`The HTTP ${req.method} method is not supported at this route.`);
  }
}
