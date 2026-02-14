import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../../../prisma/prisma';
import { createLog } from '../../../../../lib/auditLog';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { Permission, Role } from '@generated/prisma/client';
import { withHttpMethods } from '@middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';
import { GarnishExportStructure } from '../../../../../lib/auditExport';

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
    Permission.GARNISHES_CREATE,
    async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
      const { phase, exportData, decisions } = req.body as {
        phase: 'validate' | 'prepare-mapping' | 'execute';
        exportData: GarnishExportStructure | GarnishExportStructure[];
        decisions?: EntityDecision[];
      };

      const workspaceId = workspace.id;

      try {
        const items: GarnishExportStructure[] = Array.isArray(exportData) ? exportData : [exportData];

        if (phase === 'validate') {
          const entities = items.map((item) => {
            if (!item?.garnish?.name) {
              return { name: 'Unbekannt', valid: false };
            }
            return { name: item.garnish.name, valid: true };
          });

          return res.json({ valid: entities.every((e) => e.valid), entities });
        }

        if (phase === 'prepare-mapping') {
          const existingGarnishes = await prisma.garnish.findMany({
            where: { workspaceId },
            select: { id: true, name: true },
          });

          const entities = items.map((item) => {
            const name = item.garnish?.name || 'Unbekannt';
            const conflicts = existingGarnishes.filter((e) => e.name.toLowerCase() === name.toLowerCase());
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

              const itemData = decision.data as GarnishExportStructure;
              if (!itemData?.garnish) continue;

              const finalName = decision.decision === 'rename' && decision.newName ? decision.newName : itemData.garnish.name;

              try {
                if (decision.decision === 'overwrite' && decision.existingId) {
                  const oldData = await tx.garnish.findUnique({
                    where: { id: decision.existingId },
                    include: { GarnishImage: true },
                  });

                  const updated = await tx.garnish.update({
                    where: { id: decision.existingId },
                    data: {
                      name: finalName,
                      description: itemData.garnish.description ?? null,
                      notes: itemData.garnish.notes ?? null,
                      price: itemData.garnish.price ?? null,
                    },
                    include: { GarnishImage: true },
                  });

                  await createLog(tx, workspaceId, user.id, 'Garnish', decision.existingId, 'UPDATE', oldData, updated);
                  results.push({ name: finalName, status: 'overwritten' });
                } else {
                  const created = await tx.garnish.create({
                    data: {
                      name: finalName,
                      description: itemData.garnish.description ?? null,
                      notes: itemData.garnish.notes ?? null,
                      price: itemData.garnish.price ?? null,
                      workspaceId,
                    },
                    include: { GarnishImage: true },
                  });

                  await createLog(tx, workspaceId, user.id, 'Garnish', created.id, 'CREATE', null, created);
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
        console.error('Garnish import error:', error);
        return res.status(500).json({ message: error.message || 'Import failed' });
      }
    },
  ),
});
