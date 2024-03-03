import { withHttpMethods } from '../../../../../middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';
import { withWorkspacePermission } from '../../../../../middleware/api/authenticationMiddleware';
import { Role } from '@prisma/client';
import prisma from '../../../../../lib/prisma';

export default withHttpMethods({
  [HTTPMethod.PUT]: withWorkspacePermission([Role.ADMIN], async (req, res, user, workspace) => {
    const unitId = req.query.unitId as string | undefined;
    if (!unitId) return res.status(400).json({ message: 'No unit id' });

    const { unitGroupName } = req.body;

    const unit = await prisma.unit.update({
      where: {
        id: unitId,
      },
      data: {
        unitGroup: {
          connectOrCreate: {
            where: {
              workspaceId_name: {
                name: unitGroupName,
                workspaceId: workspace.id,
              },
            },
            create: {
              name: unitGroupName,
              workspaceId: workspace.id,
            },
          },
        },
      },
    });

    return res.json({ data: unit });
  }),
  [HTTPMethod.DELETE]: withWorkspacePermission([Role.ADMIN], async (req, res, user, workspace) => {
    const unitId = req.query.unitId as string | undefined;
    if (!unitId) return res.status(400).json({ message: 'No unit id' });

    const unit = await prisma.unit.delete({ where: { id: unitId } });
    return res.json({ data: unit });
  }),
});
