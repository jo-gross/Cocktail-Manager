import { withHttpMethods } from '../../../../../middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';
import { withWorkspacePermission } from '../../../../../middleware/api/authenticationMiddleware';
import prisma from '../../../../../prisma/prisma';
import { Role } from '@prisma/client';

export default withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.MANAGER], async (req, res, user, workspace) => {
    const joinCodes = await prisma.workspaceJoinCode.findMany({
      where: { workspaceId: workspace.id },
    });

    return res.json({ data: joinCodes });
  }),
  [HTTPMethod.POST]: withWorkspacePermission([Role.MANAGER], async (req, res, user, workspace) => {
    const { code, expires, onlyUseOnce } = req.body;

    const joinCodes = await prisma.workspaceJoinCode.create({
      data: {
        code: code,
        expires: expires ? new Date(expires).toISOString() : null,
        onlyUseOnce: onlyUseOnce,
        workspaceId: workspace.id,
      },
    });

    return res.json({ data: joinCodes });
  }),
});
