import prisma from '../../../../../lib/prisma';
import { NextApiRequest, NextApiResponse } from 'next';
import { CocktailCardGroupItem, Prisma, Role } from '@prisma/client';
import { withWorkspacePermission } from '../../../../../middleware/api/authenticationMiddleware';
import HTTPMethod from 'http-method-enum';
import { withHttpMethods } from '../../../../../middleware/api/handleMethods';
import CocktailCardUpdateInput = Prisma.CocktailCardUpdateInput;
import CocktailCardGroupItemCreateInput = Prisma.CocktailCardGroupItemCreateInput;

// DELETE /api/cocktails/:id

export default withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.USER], async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const cardId = req.query.cardId as string | undefined;
    if (!cardId) return res.status(400).json({ message: 'No card id' });

    const result = await prisma.cocktailCard.findFirst({
      where: {
        id: cardId,
        workspaceId: workspace.id,
      },
      include: {
        groups: {
          include: {
            items: {
              include: {
                cocktail: {
                  include: {
                    _count: { select: { CocktailRecipeImage: true } },
                    glass: { include: { _count: { select: { GlassImage: true } } } },
                    garnishes: {
                      include: {
                        garnish: true,
                      },
                    },
                    steps: {
                      include: {
                        action: true,
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
    return res.json({ data: result });
  }),
  [HTTPMethod.PUT]: withWorkspacePermission([Role.MANAGER], async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const { id, name, date, groups, showTime } = req.body;
    if (id != undefined) {
      await prisma.cocktailCardGroupItem.deleteMany({
        where: {
          cocktailCardGroup: {
            cocktailCard: {
              id: id,
            },
          },
        },
      });

      await prisma.cocktailCardGroup.deleteMany({
        where: {
          cocktailCard: {
            id: id,
          },
        },
      });
    }

    const input: CocktailCardUpdateInput = {
      id: id,
      name: name,
      date: date,
      showTime: showTime,
      workspace: { connect: { id: workspace.id } },
    };
    const cocktailCardResult = await prisma.cocktailCard.update({
      where: {
        id: id,
      },
      data: input,
    });

    if (groups.length > 0) {
      await groups.forEach(async (group: any) => {
        const groupResult = await prisma.cocktailCardGroup.create({
          data: {
            id: group.id,
            name: group.name,
            groupNumber: group.groupNumber,
            groupPrice: group.groupPrice == '' ? null : group.groupPrice,
            cocktailCard: { connect: { id: cocktailCardResult.id } },
          },
        });

        if (group.items.length > 0) {
          group.items.map(async (item: CocktailCardGroupItem) => {
            const input: CocktailCardGroupItemCreateInput = {
              cocktail: { connect: { id: item.cocktailId } },
              cocktailCardGroup: { connect: { id: groupResult.id } },
              itemNumber: item.itemNumber,
              specialPrice: item.specialPrice,
            };
            await prisma.cocktailCardGroupItem.create({
              data: input,
            });
          });
        }
      });
    }

    return res.json(cocktailCardResult);
  }),
  [HTTPMethod.DELETE]: withWorkspacePermission([Role.ADMIN], async (req: NextApiRequest, res: NextApiResponse) => {
    const cardId = req.query.cardId as string | undefined;
    if (!cardId) return res.status(400).json({ message: 'No card id' });

    await prisma.cocktailCardGroupItem.deleteMany({
      where: {
        cocktailCardGroup: {
          cocktailCardId: cardId,
        },
      },
    });
    await prisma.cocktailCardGroup.deleteMany({
      where: {
        cocktailCardId: cardId,
      },
    });
    const result = await prisma.cocktailCard.delete({
      where: {
        id: cardId,
      },
    });
    return res.json({ data: result });
  }),
});
