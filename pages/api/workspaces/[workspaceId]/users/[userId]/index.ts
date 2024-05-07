import HTTPMethod from 'http-method-enum';
import { withWorkspacePermission } from '../../../../../../middleware/api/authenticationMiddleware';
import { Role } from '@prisma/client';
import { constants as HttpStatus } from 'http2';
import prisma from '../../../../../../prisma/prisma';
import { withHttpMethods } from '../../../../../../middleware/api/handleMethods';

export default withHttpMethods({
  [HTTPMethod.DELETE]: withWorkspacePermission([Role.ADMIN], async (req, res, user, workspace) => {
    const userId = req.query.userId as string | undefined;
    if (!userId) {
      return res.status(HttpStatus.HTTP_STATUS_BAD_REQUEST).json(undefined);
    }
    if (userId == user.id) {
      return res.status(HttpStatus.HTTP_STATUS_FORBIDDEN).json(undefined);
    }

    const result = await prisma.workspaceUser.delete({
      where: {
        workspaceId_userId: {
          userId: userId,
          workspaceId: workspace.id,
        },
      },
    });
    return res.json({ data: result });
  }),

  [HTTPMethod.PUT]: withWorkspacePermission([Role.ADMIN], async (req, res, user, workspace) => {
    const { role } = req.body;
    const userId = req.query.userId as string | undefined;
    if (!userId) {
      return res.status(HttpStatus.HTTP_STATUS_BAD_REQUEST).json(undefined);
    }
    if (userId == user.id) {
      return res.status(HttpStatus.HTTP_STATUS_FORBIDDEN).json(undefined);
    }
    const result = await prisma.workspaceUser.update({
      where: {
        workspaceId_userId: {
          userId: userId,
          workspaceId: workspace.id,
        },
      },
      data: {
        role: role,
      },
    });
    return res.json({ data: result });
  }),
});
