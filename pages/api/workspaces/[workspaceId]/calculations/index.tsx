// pages/api/post/index.ts

import prisma from '../../../../../lib/prisma';
import { Prisma } from '.prisma/client';
import { NextApiRequest, NextApiResponse } from 'next';
import { withWorkspacePermission } from '../../../../../middleware/api/authenticationMiddleware';
import { withHttpMethods } from '../../../../../middleware/api/handleMethods';
import { Role } from '@prisma/client';
import HTTPMethod from 'http-method-enum';
import CocktailCalculationCreateInput = Prisma.CocktailCalculationCreateInput;

export default withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission(
    [Role.USER],
    async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
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
    },
  ),
  [HTTPMethod.POST]: withWorkspacePermission(
    [Role.USER],
    async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
      const { name, calculationItems } = req.body;
      const input: CocktailCalculationCreateInput = {
        name: name,
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
        updatedByUser: {
          connect: {
            id: user.id,
          },
        },
      };
      const result = await prisma.cocktailCalculation.create({
        data: input,
      });
      return res.json({ data: result });
    },
  ),
});
