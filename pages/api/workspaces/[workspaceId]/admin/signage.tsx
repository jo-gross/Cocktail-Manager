import HTTPMethod from 'http-method-enum';
import { withHttpMethods } from '../../../../../middleware/api/handleMethods';
import { withWorkspacePermission } from '../../../../../middleware/api/authenticationMiddleware';
import { $Enums, Role } from '@prisma/client';
import prisma from '../../../../../lib/prisma';
import { NextApiRequest, NextApiResponse } from 'next';
import MonitorFormat = $Enums.MonitorFormat;

export default withHttpMethods({
  [HTTPMethod.PUT]: withWorkspacePermission(
    [Role.MANAGER],
    async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
      const { verticalContent, horizontalContent, verticalBgColor, horizontalBgColor } = JSON.parse(req.body);
      console.log('Updating signage', verticalContent, horizontalContent, verticalBgColor, horizontalBgColor);

      await prisma.signage.deleteMany({
        where: {
          workspaceId: workspace.id,
        },
      });

      if (verticalContent != undefined && verticalContent != '') {
        const verticalSignage = await prisma.signage.create({
          data: {
            workspaceId: workspace.id,
            format: MonitorFormat.PORTRAIT,
            content: verticalContent,
            backgroundColor: verticalBgColor == '' ? undefined : verticalBgColor,
          },
        });
      }

      if (horizontalContent != undefined && horizontalContent != '') {
        const horizontalSignage = await prisma.signage.create({
          data: {
            workspaceId: workspace.id,
            format: MonitorFormat.LANDSCAPE,
            content: horizontalContent,
            backgroundColor: horizontalBgColor == '' ? undefined : horizontalBgColor,
          },
        });
      }

      res.status(200).json({ message: 'Signage updated' });
    },
  ),
});
