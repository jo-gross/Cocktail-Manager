import { withHttpMethods } from '../../../../../../middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';
import { withWorkspacePermission } from '../../../../../../middleware/api/authenticationMiddleware';
import prisma from '../../../../../../prisma/prisma';
import { Role } from '@prisma/client';

export default withHttpMethods({
  [HTTPMethod.POST]: withWorkspacePermission([Role.MANAGER], async (req, res, user, workspace) => {
    try {
      await prisma.$transaction(async (transaction) => {
        await transaction.workspaceJoinRequests.delete({
          where: {
            userId_workspaceId: {
              workspaceId: workspace.id,
              userId: req.query.userId as string,
            },
          },
        });
        //TODO: Send notification to user
      });
      return res.json({ data: 'ok' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ msg: 'Error' });
    }
  }),
});
