import { Prisma, Role } from '@prisma/client';
import { withHttpMethods } from '../../../../middleware/api/handleMethods';
import { withWorkspacePermission } from '../../../../middleware/api/authenticationMiddleware';
import HTTPMethod from 'http-method-enum';
import prisma from '../../../../lib/prisma';
import WorkspaceUpdateInput = Prisma.WorkspaceUpdateInput;

export default withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.USER], async (req, res, user, workspace) => {
    return res.json({ data: workspace });
  }),
  [HTTPMethod.DELETE]: withWorkspacePermission([Role.ADMIN], async (req, res, user, workspace) => {
    const result = await prisma.workspace.delete({
      where: {
        id: workspace.id,
      },
    });
    return res.json({ data: result });
  }),
  [HTTPMethod.PUT]: withWorkspacePermission([Role.MANAGER], async (req, res, user, workspace) => {
    const { name } = req.body;
    const update: WorkspaceUpdateInput = {
      id: workspace.id,
      name: name,
    };

    const result = await prisma.workspace.update({
      where: {
        id: workspace.id,
      },
      data: update,
    });
    return res.json({ data: result });
  }),
});
