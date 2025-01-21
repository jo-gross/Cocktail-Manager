import { withHttpMethods } from '../../../../../middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';
import { withAuthentication, withWorkspacePermission } from '../../../../../middleware/api/authenticationMiddleware';
import prisma from '../../../../../prisma/prisma';
import { Role } from '@prisma/client';

export default withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.MANAGER], async (req, res, user, workspace) => {
    const joinRequests = await prisma.workspaceJoinRequest.findMany({
      where: { workspaceId: workspace.id },
      include: {
        user: true,
      },
    });

    return res.json({ data: joinRequests });
  }),
  [HTTPMethod.DELETE]: withAuthentication(async (req, res, user) => {
    try {
      await prisma.$transaction(async (transaction) => {
        const deleteResult = await transaction.workspaceJoinRequest.delete({
          where: {
            userId_workspaceId: {
              workspaceId: req.query.workspaceId as string,
              userId: user.id as string,
            },
          },
        });
        return res.json({ data: deleteResult });
      });
      return res.status(500).json({ msg: 'Error' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ msg: 'Error' });
    }
  }),
});
