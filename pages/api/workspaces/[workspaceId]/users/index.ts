import { withHttpMethods } from '@middleware/api/handleMethods';
import { Role, Permission } from '@generated/prisma/client';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import prisma from '../../../../../prisma/prisma';
import HTTPMethod from 'http-method-enum';

export default withHttpMethods({
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
                provider: true,
              },
            },
          },
        },
      },
    });
    return res.json({ data: result });
  }),
});
