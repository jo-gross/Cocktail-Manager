import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../../../prisma/prisma';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { Role } from '@generated/prisma/client';
import { withHttpMethods } from '@middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';
import packageJson from '../../../../../package.json';
import { CocktailCalculationExportStructure } from '../../../../../lib/auditExport';

export default withHttpMethods({
  [HTTPMethod.POST]: withWorkspacePermission([Role.USER], async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const { ids } = req.body as { ids: string[] };

    if (!ids || ids.length === 0) {
      return res.status(400).json({ message: 'Keine Kalkulationen ausgewählt' });
    }

    try {
      const calculations = await prisma.cocktailCalculation.findMany({
        where: { id: { in: ids }, workspaceId: workspace.id },
        include: {
          cocktailCalculationItems: {
            include: { cocktail: { select: { name: true } } },
          },
          ingredientShoppingUnits: {
            include: {
              ingredient: { select: { name: true } },
              unit: { select: { name: true } },
            },
          },
        },
      });

      if (calculations.length === 0) {
        return res.status(404).json({ message: 'Keine Kalkulationen gefunden' });
      }

      const exportData: CocktailCalculationExportStructure[] = calculations.map((calc) => ({
        exportVersion: packageJson.version,
        exportDate: new Date().toISOString(),
        calculation: {
          id: calc.id,
          name: calc.name,
          showSalesStuff: calc.showSalesStuff,
          workspaceId: calc.workspaceId,
          updatedByUserId: calc.updatedByUserId,
        },
        cocktailCalculationItems: calc.cocktailCalculationItems.map((item) => ({
          calculationId: calc.id,
          cocktailId: item.cocktailId,
          cocktailName: item.cocktail?.name || item.cocktailId,
          plannedAmount: item.plannedAmount,
          customPrice: item.customPrice,
        })),
        ingredientShoppingUnits: calc.ingredientShoppingUnits.map((su) => ({
          ingredientId: su.ingredientId,
          ingredientName: su.ingredient?.name || su.ingredientId,
          unitId: su.unitId,
          unitName: su.unit?.name || su.unitId,
          checked: su.checked,
          cocktailCalculationId: calc.id,
        })),
      }));

      return res.json(exportData.length === 1 ? exportData[0] : exportData);
    } catch (error) {
      console.error('Calculation export error:', error);
      return res.status(500).json({ message: 'Fehler beim Exportieren' });
    }
  }),
});
