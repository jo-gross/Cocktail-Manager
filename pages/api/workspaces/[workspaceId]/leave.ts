import { withHttpMethods } from '../../../../middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';
import { withWorkspacePermission } from '../../../../middleware/api/authenticationMiddleware';
import prisma from '../../../../lib/prisma';
import { Role } from '@prisma/client';

export default withHttpMethods({
  [HTTPMethod.POST]: withWorkspacePermission([Role.USER], async (req, res, user, workspace) => {
    const result = await prisma.workspaceUser.delete({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId: user.id,
        },
      },
    });
    return res.json({ data: result });
  }),
});
