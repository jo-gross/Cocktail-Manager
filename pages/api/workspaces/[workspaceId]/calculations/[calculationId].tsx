import prisma from '../../../../../lib/prisma';
import { NextApiRequest, NextApiResponse } from 'next';
import HTTPMethod from 'http-method-enum';
import { withWorkspacePermission } from '../../../../../middleware/api/authenticationMiddleware';
import { Prisma, Role } from '@prisma/client';
import { withHttpMethods } from '../../../../../middleware/api/handleMethods';
import CocktailCalculationUpdateInput = Prisma.CocktailCalculationUpdateInput;

// DELETE /api/glasses/:id

export default withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.USER], async (req: NextApiRequest, res: NextApiResponse) => {
    const calculationId = req.query.calculationId as string | undefined;
    if (!calculationId) return res.status(400).json({ message: 'No calculation id' });

    const result = await prisma.cocktailCalculation.findUnique({
      where: {
        id: calculationId,
      },
      include: {
        updatedByUser: true,
        cocktailCalculationItems: {
          include: {
            cocktail: {
              include: {
                steps: {
                  include: {
                    action: true,
                    ingredients: {
                      include: {
                        ingredient: true,
                        unit: true,
                      },
                    },
                  },
                },
                garnishes: {
                  include: {
                    garnish: true,
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
  [HTTPMethod.DELETE]: withWorkspacePermission([Role.ADMIN], async (req: NextApiRequest, res: NextApiResponse) => {
    const calculationId = req.query.calculationId as string | undefined;
    if (!calculationId) return res.status(400).json({ message: 'No cocktailCalculation id' });
    const result = await prisma.cocktailCalculation.delete({
      where: {
        id: calculationId,
      },
    });
    return res.json({ data: result });
  }),
  [HTTPMethod.PUT]: withWorkspacePermission([Role.USER], async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const calculationId = req.query.calculationId as string | undefined;
    if (!calculationId) return res.status(400).json({ message: 'No calculationId id' });
    const { name, calculationItems, showSalesStuff } = req.body;
    const input: CocktailCalculationUpdateInput = {
      id: calculationId,
      name: name,
      showSalesStuff: showSalesStuff,
      updatedByUser: {
        connect: {
          id: user.id,
        },
      },
      cocktailCalculationItems: {
        create: calculationItems.map((item: any) => ({
          plannedAmount: item.plannedAmount,
          customPrice: item.customPrice,
          cocktail: {
            connect: {
              id: item.cocktailId,
            },
          },
        })),
      },
    };

    await prisma.cocktailCalculationItems.deleteMany({
      where: {
        calculationId: calculationId,
      },
    });

    const result = await prisma.cocktailCalculation.update({
      where: {
        id: calculationId,
      },
      data: input,
    });
    return res.json({ data: result });
  }),
});
