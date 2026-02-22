import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../../../../prisma/prisma';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { Permission, Role } from '@generated/prisma/client';
import { withHttpMethods } from '@middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';

export default withHttpMethods({
  [HTTPMethod.PUT]: withWorkspacePermission([Role.USER], Permission.CALCULATIONS_UPDATE, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const groupId = req.query.groupId as string | undefined;
    if (!groupId) return res.status(400).json({ message: 'Keine Gruppen-ID' });

    const { name, isDefaultExpanded } = req.body as { name?: string; isDefaultExpanded?: boolean };

    if (!name || name.trim() === '') {
      return res.status(400).json({ message: 'Gruppenname fehlt' });
    }

    const existing = await prisma.cocktailCalculationGroup.findFirst({
      where: { id: groupId, workspaceId: workspace.id },
    });
    if (!existing) {
      return res.status(404).json({ message: 'Gruppe nicht gefunden' });
    }

    try {
      const updated = await prisma.cocktailCalculationGroup.update({
        where: { id: groupId },
        data: {
          name: name.trim(),
          isDefaultExpanded: Boolean(isDefaultExpanded),
        },
      });
      return res.json({ data: updated });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        return res.status(409).json({ message: 'Eine Gruppe mit diesem Namen existiert bereits' });
      }
      console.error('CalculationGroup -> update', error);
      return res.status(500).json({ message: 'Fehler beim Aktualisieren der Gruppe' });
    }
  }),
  [HTTPMethod.DELETE]: withWorkspacePermission(
    [Role.USER],
    Permission.CALCULATIONS_UPDATE,
    async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
      const groupId = req.query.groupId as string | undefined;
      if (!groupId) return res.status(400).json({ message: 'Keine Gruppen-ID' });

      const existing = await prisma.cocktailCalculationGroup.findFirst({
        where: { id: groupId, workspaceId: workspace.id },
      });
      if (!existing) {
        return res.status(404).json({ message: 'Gruppe nicht gefunden' });
      }

      await prisma.cocktailCalculationGroup.delete({ where: { id: groupId } });
      return res.json({ data: { id: groupId } });
    },
  ),
});
