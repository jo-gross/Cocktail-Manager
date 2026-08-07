import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../../../prisma/prisma';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { Role } from '@generated/prisma/client';
import { withHttpMethods } from '@middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';
import { withDeprecation } from '@middleware/api/withDeprecation';
import packageJson from '../../../../../package.json';
import { GarnishExportStructure } from '../../../../../lib/auditExport';

const legacyHandler = withHttpMethods({
  [HTTPMethod.POST]: withWorkspacePermission([Role.USER], async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const { ids } = req.body as { ids: string[] };

    if (!ids || ids.length === 0) {
      return res.status(400).json({ message: 'No garnishes selected' });
    }

    try {
      const garnishes = await prisma.garnish.findMany({
        where: { id: { in: ids }, workspaceId: workspace.id },
      });

      if (garnishes.length === 0) {
        return res.status(404).json({ message: 'No garnishes found' });
      }

      const exportData: GarnishExportStructure[] = garnishes.map((garnish) => ({
        exportVersion: packageJson.version,
        exportDate: new Date().toISOString(),
        garnish: {
          id: garnish.id,
          name: garnish.name,
          description: garnish.description,
          notes: garnish.notes,
          price: garnish.price,
          workspaceId: garnish.workspaceId,
        },
      }));

      return res.json(exportData.length === 1 ? exportData[0] : exportData);
    } catch (error) {
      console.error('Garnish export error:', error);
      return res.status(500).json({ message: 'Failed to export' });
    }
  }),
});

// DEPRECATED: unversioned endpoint kept for backward compatibility. Behavior is
// unchanged; only advertises the successor v1 path. Use /api/v1/... instead.
export default withDeprecation({ successor: '/api/v1/workspaces/{workspaceId}/garnishes/export/json' }, legacyHandler);
