import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../../../prisma/prisma';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { Role } from '@generated/prisma/client';
import { withHttpMethods } from '@middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';
import packageJson from '../../../../../package.json';
import { IngredientExportStructure } from '../../../../../lib/auditExport';

export default withHttpMethods({
  [HTTPMethod.POST]: withWorkspacePermission([Role.USER], async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const { ids } = req.body as { ids: string[] };

    if (!ids || ids.length === 0) {
      return res.status(400).json({ message: 'Keine Zutaten ausgewählt' });
    }

    try {
      const ingredients = await prisma.ingredient.findMany({
        where: { id: { in: ids }, workspaceId: workspace.id },
        include: {
          IngredientVolume: {
            include: { unit: true },
          },
        },
      });

      if (ingredients.length === 0) {
        return res.status(404).json({ message: 'Keine Zutaten gefunden' });
      }

      const exportData: IngredientExportStructure[] = ingredients.map((ingredient) => {
        const unitsMap = new Map<string, any>();
        const ingredientVolumes = ingredient.IngredientVolume.map((v) => {
          if (v.unit) {
            unitsMap.set(v.unit.id, {
              id: v.unit.id,
              name: v.unit.name,
              workspaceId: v.unit.workspaceId,
            });
          }
          return {
            id: v.id,
            volume: v.volume,
            ingredientId: ingredient.id,
            unitId: v.unitId,
            workspaceId: v.workspaceId,
          };
        });

        return {
          exportVersion: packageJson.version,
          exportDate: new Date().toISOString(),
          ingredient: {
            id: ingredient.id,
            name: ingredient.name,
            shortName: ingredient.shortName,
            description: ingredient.description,
            notes: ingredient.notes,
            price: ingredient.price,
            link: ingredient.link,
            tags: ingredient.tags,
            workspaceId: ingredient.workspaceId,
          },
          ingredientVolumes,
          units: Array.from(unitsMap.values()),
        };
      });

      return res.json(exportData.length === 1 ? exportData[0] : exportData);
    } catch (error) {
      console.error('Ingredient export error:', error);
      return res.status(500).json({ message: 'Fehler beim Exportieren' });
    }
  }),
});
