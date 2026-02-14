import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../../../prisma/prisma';
import { createLog } from '../../../../../lib/auditLog';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { Permission, Role } from '@generated/prisma/client';
import { withHttpMethods } from '@middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';
import { IngredientExportStructure } from '../../../../../lib/auditExport';

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
};

interface EntityDecision {
  exportName: string;
  decision: 'import' | 'overwrite' | 'rename' | 'skip';
  existingId?: string;
  newName?: string;
  data: any;
}

export default withHttpMethods({
  [HTTPMethod.POST]: withWorkspacePermission(
    [Role.MANAGER],
    Permission.INGREDIENTS_CREATE,
    async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
      const { phase, exportData, decisions } = req.body as {
        phase: 'validate' | 'prepare-mapping' | 'execute';
        exportData: IngredientExportStructure | IngredientExportStructure[];
        decisions?: EntityDecision[];
      };

      const workspaceId = workspace.id;

      try {
        const items: IngredientExportStructure[] = Array.isArray(exportData) ? exportData : [exportData];

        if (phase === 'validate') {
          const entities = items.map((item) => {
            if (!item?.ingredient?.name) {
              return { name: 'Unbekannt', valid: false };
            }
            return { name: item.ingredient.name, valid: true };
          });

          return res.json({ valid: entities.every((e) => e.valid), entities });
        }

        if (phase === 'prepare-mapping') {
          const existingIngredients = await prisma.ingredient.findMany({
            where: { workspaceId },
            select: { id: true, name: true },
          });

          const entities = items.map((item) => {
            const name = item.ingredient?.name || 'Unbekannt';
            const conflicts = existingIngredients.filter((e) => e.name.toLowerCase() === name.toLowerCase());
            return {
              name,
              data: item,
              conflicts: conflicts.map((c) => ({ id: c.id, name: c.name })),
            };
          });

          return res.json({ entities });
        }

        if (phase === 'execute') {
          if (!decisions || decisions.length === 0) {
            return res.status(400).json({ message: 'Keine Entscheidungen angegeben' });
          }

          const results: Array<{ name: string; status: string; message?: string }> = [];

          await prisma.$transaction(async (tx) => {
            for (const decision of decisions) {
              if (decision.decision === 'skip') {
                results.push({ name: decision.exportName, status: 'skipped' });
                continue;
              }

              const itemData = decision.data as IngredientExportStructure;
              if (!itemData?.ingredient) continue;

              const finalName = decision.decision === 'rename' && decision.newName ? decision.newName : itemData.ingredient.name;

              try {
                if (decision.decision === 'overwrite' && decision.existingId) {
                  const oldData = await tx.ingredient.findUnique({
                    where: { id: decision.existingId },
                    include: { IngredientImage: true, IngredientVolume: { include: { unit: true } } },
                  });

                  // Delete existing volumes before re-creating
                  await tx.ingredientVolume.deleteMany({
                    where: { ingredientId: decision.existingId },
                  });

                  const updated = await tx.ingredient.update({
                    where: { id: decision.existingId },
                    data: {
                      name: finalName,
                      shortName: itemData.ingredient.shortName ?? null,
                      description: itemData.ingredient.description ?? null,
                      notes: itemData.ingredient.notes ?? null,
                      price: itemData.ingredient.price ?? null,
                      link: itemData.ingredient.link ?? null,
                      tags: itemData.ingredient.tags ?? [],
                    },
                  });

                  // Re-create volumes
                  await createVolumes(tx, decision.existingId, workspaceId, itemData);

                  const fullUpdated = await tx.ingredient.findUnique({
                    where: { id: decision.existingId },
                    include: { IngredientImage: true, IngredientVolume: { include: { unit: true } } },
                  });

                  await createLog(tx, workspaceId, user.id, 'Ingredient', decision.existingId, 'UPDATE', oldData, fullUpdated);
                  results.push({ name: finalName, status: 'overwritten' });
                } else {
                  const created = await tx.ingredient.create({
                    data: {
                      name: finalName,
                      shortName: itemData.ingredient.shortName ?? null,
                      description: itemData.ingredient.description ?? null,
                      notes: itemData.ingredient.notes ?? null,
                      price: itemData.ingredient.price ?? null,
                      link: itemData.ingredient.link ?? null,
                      tags: itemData.ingredient.tags ?? [],
                      workspaceId,
                    },
                  });

                  await createVolumes(tx, created.id, workspaceId, itemData);

                  const fullCreated = await tx.ingredient.findUnique({
                    where: { id: created.id },
                    include: { IngredientImage: true, IngredientVolume: { include: { unit: true } } },
                  });

                  await createLog(tx, workspaceId, user.id, 'Ingredient', created.id, 'CREATE', null, fullCreated);
                  results.push({ name: finalName, status: 'created' });
                }
              } catch (err: any) {
                results.push({ name: finalName, status: 'error', message: err.message });
              }
            }
          });

          return res.json({ success: true, results });
        }

        return res.status(400).json({ message: 'Ungültige Phase' });
      } catch (error: any) {
        console.error('Ingredient import error:', error);
        return res.status(500).json({ message: error.message || 'Import failed' });
      }
    },
  ),
});

async function createVolumes(tx: any, ingredientId: string, workspaceId: string, itemData: IngredientExportStructure) {
  if (!itemData.ingredientVolumes || !itemData.units) return;

  for (const vol of itemData.ingredientVolumes) {
    const exportUnit = itemData.units.find((u) => u.id === vol.unitId);
    if (!exportUnit) continue;

    let unit = await tx.unit.findFirst({
      where: { name: exportUnit.name, workspaceId },
    });

    if (!unit) {
      unit = await tx.unit.create({
        data: { name: exportUnit.name, workspaceId },
      });
    }

    await tx.ingredientVolume.create({
      data: {
        volume: vol.volume,
        ingredientId,
        unitId: unit.id,
        workspaceId,
      },
    });
  }
}
