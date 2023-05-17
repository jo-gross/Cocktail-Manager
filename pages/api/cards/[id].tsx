import prisma from '../../../lib/prisma';
import { NextApiRequest, NextApiResponse } from 'next';

// DELETE /api/cocktails/:id

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  const id = req.query.id as string | undefined;
  if (id == undefined) {
    return res.status(400).json({ message: 'id is undefined' });
  } else if (req.method === 'GET') {
    const result = await prisma.cocktailCard.findFirst({
      where: {
        id: id,
      },
      include: {
        groups: {
          include: {
            items: {
              include: {
                cocktail: {
                  include: {
                    glass: true,
                    decoration: true,
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
                },
              },
            },
          },
        },
      },
    });
    return res.json(result);
  } else if (req.method === 'DELETE') {
    const cocktailRecipeIngredients = await prisma.cocktailCardGroupItem.deleteMany({
      where: {
        cocktailCardGroup: {
          cocktailCardId: id,
        },
      },
    });
    const cocktailRecipeSteps = await prisma.cocktailCardGroup.deleteMany({
      where: {
        cocktailCardId: id,
      },
    });
    const result = await prisma.cocktailCard.delete({
      where: {
        id: id,
      },
    });
    return res.json(result);
  } else {
    throw new Error(`The HTTP ${req.method} method is not supported at this route.`);
  }
}
