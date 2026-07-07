import HTTPMethod from 'http-method-enum';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { Role, Permission } from '@generated/prisma/client';
import { constants as HttpStatus } from 'http2';
import prisma from '../../../../../../prisma/prisma';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { withDeprecation } from '@middleware/api/withDeprecation';

const legacyHandler = withHttpMethods({
  [HTTPMethod.DELETE]: withWorkspacePermission([Role.ADMIN], Permission.USERS_DELETE, async (req, res, user, workspace) => {
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

  [HTTPMethod.PUT]: withWorkspacePermission([Role.ADMIN], Permission.USERS_UPDATE, async (req, res, user, workspace) => {
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

// DEPRECATED: unversioned endpoint kept for backward compatibility. Behavior is
// unchanged; only advertises the successor v1 path. Use /api/v1/... instead.
export default withDeprecation({ successor: '/api/v1/workspaces/{workspaceId}/users/{userId}' }, legacyHandler);
