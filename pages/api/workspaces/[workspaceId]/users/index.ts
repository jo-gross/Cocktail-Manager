import { withHttpMethods } from '@middleware/api/handleMethods';
import { Role, Permission } from '@generated/prisma/client';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { withDeprecation } from '@middleware/api/withDeprecation';
import prisma from '../../../../../prisma/prisma';
import HTTPMethod from 'http-method-enum';

const legacyHandler = withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.USER], Permission.USERS_READ, async (req, res, user, workspace) => {
    const result = await prisma.workspaceUser.findMany({
      where: {
        workspaceId: workspace.id,
      },
      include: {
        user: {
          include: {
            accounts: {
              select: {
                providerId: true,
              },
            },
          },
        },
      },
    });
    return res.json({ data: result });
  }),
});

// DEPRECATED: unversioned endpoint kept for backward compatibility. Behavior is
// unchanged; only advertises the successor v1 path. Use /api/v1/... instead.
export default withDeprecation({ successor: '/api/v1/workspaces/{workspaceId}/users' }, legacyHandler);
