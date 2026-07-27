import { withHttpMethods } from '@middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import prisma from '../../../../../../prisma/prisma';
import { Role } from '@generated/prisma/client';
import { withDeprecation } from '@middleware/api/withDeprecation';

const legacyHandler = withHttpMethods({
  [HTTPMethod.DELETE]: withWorkspacePermission([Role.MANAGER], async (req, res, user, workspace) => {
    try {
      await prisma.workspaceJoinCode.delete({
        where: {
          workspaceId_code: {
            workspaceId: workspace.id,
            code: req.query.code as string,
          },
        },
      });
      return res.json({ data: 'ok' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ msg: 'Error' });
    }
  }),
});

// DEPRECATED: unversioned endpoint kept for backward compatibility. Use /api/v1/... instead.
export default withDeprecation({ successor: '/api/v1/workspaces/{workspaceId}/join-codes/{code}' }, legacyHandler);
