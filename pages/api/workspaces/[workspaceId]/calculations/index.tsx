// pages/api/post/index.ts

import prisma from '../../../../../prisma/prisma';
import { createLog } from '../../../../../lib/auditLog';
import { NextApiRequest, NextApiResponse } from 'next';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { Permission, Prisma, Role } from '@generated/prisma/client';
import HTTPMethod from 'http-method-enum';
import CocktailCalculationCreateInput = Prisma.CocktailCalculationCreateInput;

export default withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.USER], Permission.CALCULATIONS_READ, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const cocktailCalculations = await prisma.cocktailCalculation.findMany({
      where: {
        workspaceId: workspace.id,
      },
      include: {
        updatedByUser: true,
        cocktailCalculationItems: {
          include: {
            cocktail: true,
          },
        },
      },
    });
    return res.json({ data: cocktailCalculations });
  }),
  [HTTPMethod.POST]: withWorkspacePermission(
    [Role.USER],
    Permission.CALCULATIONS_CREATE,
    async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
      const { name, calculationItems, showSalesStuff, ingredientShoppingUnits } = req.body;

      const result = await prisma.$transaction(async (tx) => {
        const input: CocktailCalculationCreateInput = {
          name: name,
          showSalesStuff: showSalesStuff,
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
          workspace: {
            connect: {
              id: workspace.id,
            },
          },
          ingredientShoppingUnits: {
            create: ingredientShoppingUnits.map((ingredientShoppingUnit: any) => ({
              ingredient: { connect: { id: ingredientShoppingUnit.ingredientId } },
              unit: { connect: { id: ingredientShoppingUnit.unitId } },
              checked: ingredientShoppingUnit.checked,
            })),
          },
          updatedByUser: {
            connect: {
              id: user.id,
            },
          },
        };

        const createdCalculation = await tx.cocktailCalculation.create({
          data: input,
          include: {
            cocktailCalculationItems: { include: { cocktail: { select: { name: true } } } },
            ingredientShoppingUnits: { include: { ingredient: { select: { name: true } }, unit: { select: { name: true } } } },
          },
        });

        await createLog(tx, workspace.id, user.id, 'CocktailCalculation', createdCalculation.id, 'CREATE', null, createdCalculation);

        return createdCalculation;
      });

      return res.json({ data: result });
    },
  ),
});
