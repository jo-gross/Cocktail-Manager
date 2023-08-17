import prisma from '../../../../../lib/prisma';
import { NextApiRequest, NextApiResponse } from 'next';

// DELETE /api/cocktails/:id

export default async function handle(req: NextApiRequest, res: NextApiResponse) {
  const workspaceId = req.query.workspaceId as string | undefined;
  if (!workspaceId) return res.status(400).json({ message: 'No workspace id' });
  const cardId = req.query.cardId as string | undefined;
  if (!cardId) return res.status(400).json({ message: 'No card id' });

  if (req.method === 'GET') {
    const result = await prisma.cocktailCard.findFirst({
      where: {
        id: cardId,
        workspaceId: workspaceId,
      },
      include: {
        groups: {
          include: {
            items: {
              include: {
                cocktail: {
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
          cocktailCardId: cardId,
        },
      },
    });
    const cocktailRecipeSteps = await prisma.cocktailCardGroup.deleteMany({
      where: {
        cocktailCardId: cardId,
      },
    });
    const result = await prisma.cocktailCard.delete({
      where: {
        id: cardId,
      },
    });
    return res.json(result);
  } else {
    throw new Error(`The HTTP ${req.method} method is not supported at this route.`);
  }
}
