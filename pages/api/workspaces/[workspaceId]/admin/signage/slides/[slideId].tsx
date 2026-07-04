import HTTPMethod from 'http-method-enum';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { Permission, Role } from '@generated/prisma/client';
import prisma from '../../../../../../../prisma/prisma';
import { NextApiRequest, NextApiResponse } from 'next';

export default withHttpMethods({
  [HTTPMethod.DELETE]: withWorkspacePermission(
    [Role.MANAGER],
    Permission.MONITOR_UPDATE,
    async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
      const { slideId } = req.query;

      if (!slideId || typeof slideId !== 'string') {
        return res.status(400).json({ message: 'Slide id is required' });
      }

      const result = await prisma.signageSlide.deleteMany({
        where: {
          id: slideId,
          workspaceId: workspace.id,
        },
      });

      if (result.count === 0) {
        return res.status(404).json({ message: 'Slide not found' });
      }

      res.status(200).json({ message: 'Slide deleted' });
    },
  ),
});
