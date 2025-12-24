import { withHttpMethods } from '@middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { Role, Permission } from '@generated/prisma/client';
import prisma from '../../../../../../prisma/prisma';
import { regenerateUnitConversions } from './index';

export default withHttpMethods({
  [HTTPMethod.PUT]: withWorkspacePermission([Role.ADMIN], Permission.UNITS_UPDATE, async (req, res, user, workspace) => {
    const unitConversionId = req.query.unitConversionId as string | undefined;
    if (!unitConversionId) return res.status(400).json({ message: 'No unitConversion id' });

    const { factor } = req.body;
    const unitConversion = await prisma.unitConversion.update({
      where: { id: unitConversionId },
      data: {
        factor: factor,
      },
    });
    await regenerateUnitConversions(workspace.id);
    return res.json({ data: unitConversion });
  }),
  [HTTPMethod.DELETE]: withWorkspacePermission([Role.ADMIN], async (req, res, user, workspace) => {
    const unitConversionId = req.query.unitConversionId as string | undefined;
    if (!unitConversionId) return res.status(400).json({ message: 'No unitConversion id' });

    const unitConversion = await prisma.unitConversion.delete({ where: { id: unitConversionId } });
    await regenerateUnitConversions(workspace.id);
    return res.json({ data: unitConversion });
  }),
});
