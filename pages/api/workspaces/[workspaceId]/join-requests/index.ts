import { withHttpMethods } from '../../../../../middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';
import { withWorkspacePermission } from '../../../../../middleware/api/authenticationMiddleware';
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
});
