import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../../../../prisma/prisma';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { Permission, Role } from '@generated/prisma/client';
import { withHttpMethods } from '@middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';

export default withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.USER], Permission.CALCULATIONS_READ, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const groups = await prisma.cocktailCalculationGroup.findMany({
      where: { workspaceId: workspace.id },
      include: {
        _count: {
          select: { calculations: true },
        },
      },
      orderBy: [{ name: 'asc' }],
    });
    return res.json({ data: groups });
  }),
  [HTTPMethod.POST]: withWorkspacePermission(
    [Role.USER],
    Permission.CALCULATIONS_UPDATE,
    async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
      const { name, isDefaultExpanded } = req.body as { name?: string; isDefaultExpanded?: boolean };

      if (!name || name.trim() === '') {
        return res.status(400).json({ message: 'Gruppenname fehlt' });
      }

      try {
        const group = await prisma.cocktailCalculationGroup.create({
          data: {
            name: name.trim(),
            isDefaultExpanded: Boolean(isDefaultExpanded),
            workspaceId: workspace.id,
          },
        });
        return res.json({ data: group });
      } catch (error: unknown) {
        if (error != null && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
          return res.status(409).json({ message: 'Eine Gruppe mit diesem Namen existiert bereits' });
        }
        console.error('CalculationGroup -> create', error);
        return res.status(500).json({ message: 'Fehler beim Erstellen der Gruppe' });
      }
    },
  ),
});
