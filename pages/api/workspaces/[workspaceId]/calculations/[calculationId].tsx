import prisma from '../../../../../prisma/prisma';
import { createLog } from '../../../../../lib/auditLog';
import { NextApiRequest, NextApiResponse } from 'next';
import HTTPMethod from 'http-method-enum';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { Permission, Prisma, Role } from '@generated/prisma/client';
import { withHttpMethods } from '@middleware/api/handleMethods';
import CocktailCalculationUpdateInput = Prisma.CocktailCalculationUpdateInput;

// DELETE /api/glasses/:id

export default withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.USER], Permission.CALCULATIONS_READ, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const calculationId = req.query.calculationId as string | undefined;
    if (!calculationId) return res.status(400).json({ message: 'No calculation id' });

    const result = await prisma.cocktailCalculation.findUnique({
      where: {
        id: calculationId,
        workspaceId: workspace.id,
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
                ratings: true,
              },
            },
          },
        },
        ingredientShoppingUnits: true,
      },
    });
    return res.json({ data: result });
  }),
  [HTTPMethod.DELETE]: withWorkspacePermission(
    [Role.ADMIN],
    Permission.CALCULATIONS_DELETE,
    async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
      const calculationId = req.query.calculationId as string | undefined;
      if (!calculationId) return res.status(400).json({ message: 'No cocktailCalculation id' });

      await prisma.$transaction(async (tx) => {
        const oldCalculation = await tx.cocktailCalculation.findUnique({
          where: { id: calculationId },
          include: { cocktailCalculationItems: true, ingredientShoppingUnits: true },
        });

        await tx.cocktailCalculation.delete({
          where: {
            id: calculationId,
            workspaceId: workspace.id,
          },
        });

        await createLog(tx, workspace.id, user.id, 'CocktailCalculation', calculationId, 'DELETE', oldCalculation, null);
      });

      return res.json({ data: { count: 1 } });
    },
  ),
  [HTTPMethod.PUT]: withWorkspacePermission([Role.USER], Permission.CALCULATIONS_UPDATE, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const calculationId = req.query.calculationId as string | undefined;
    if (!calculationId) return res.status(400).json({ message: 'No calculationId id' });
    const { name, calculationItems, showSalesStuff, ingredientShoppingUnits } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      const oldCalculation = await tx.cocktailCalculation.findUnique({
        where: { id: calculationId },
        include: { cocktailCalculationItems: true, ingredientShoppingUnits: true },
      });

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
        ingredientShoppingUnits: {
          create: ingredientShoppingUnits.map((ingredientShoppingUnit: any) => ({
            ingredient: { connect: { id: ingredientShoppingUnit.ingredientId } },
            unit: { connect: { id: ingredientShoppingUnit.unitId } },
            checked: ingredientShoppingUnit.checked,
          })),
        },
      };

      await tx.cocktailCalculationItems.deleteMany({
        where: {
          calculationId: calculationId,
        },
      });

      await tx.calculationIngredientShoppingUnit.deleteMany({
        where: {
          cocktailCalculationId: calculationId,
        },
      });

      const updatedCalculation = await tx.cocktailCalculation.update({
        where: {
          id: calculationId,
        },
        data: input,
        include: {
          cocktailCalculationItems: true,
          ingredientShoppingUnits: true,
        },
      });

      await createLog(tx, workspace.id, user.id, 'CocktailCalculation', calculationId, 'UPDATE', oldCalculation, updatedCalculation);

      return updatedCalculation;
    });

    return res.json({ data: result });
  }),
});
