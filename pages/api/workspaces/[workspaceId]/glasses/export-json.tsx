import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../../../prisma/prisma';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { Role } from '@generated/prisma/client';
import { withHttpMethods } from '@middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';
import packageJson from '../../../../../package.json';
import { GlassExportStructure } from '../../../../../lib/auditExport';

export default withHttpMethods({
  [HTTPMethod.POST]: withWorkspacePermission([Role.USER], async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const { ids } = req.body as { ids: string[] };

    if (!ids || ids.length === 0) {
      return res.status(400).json({ message: 'Keine Gläser ausgewählt' });
    }

    try {
      const glasses = await prisma.glass.findMany({
        where: { id: { in: ids }, workspaceId: workspace.id },
      });

      if (glasses.length === 0) {
        return res.status(404).json({ message: 'Keine Gläser gefunden' });
      }

      const exportData: GlassExportStructure[] = glasses.map((glass) => ({
        exportVersion: packageJson.version,
        exportDate: new Date().toISOString(),
        glass: {
          id: glass.id,
          name: glass.name,
          notes: glass.notes,
          volume: glass.volume,
          deposit: glass.deposit,
          workspaceId: glass.workspaceId,
        },
      }));

      return res.json(exportData.length === 1 ? exportData[0] : exportData);
    } catch (error) {
      console.error('Glass export error:', error);
      return res.status(500).json({ message: 'Fehler beim Exportieren' });
    }
  }),
});
