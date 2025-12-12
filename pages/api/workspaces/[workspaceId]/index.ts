import { Prisma, Role, Permission } from '@generated/prisma/client';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import HTTPMethod from 'http-method-enum';
import prisma from '../../../../prisma/prisma';
import WorkspaceUpdateInput = Prisma.WorkspaceUpdateInput;

export default withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.USER], Permission.WORKSPACE_READ, async (req, res, user, workspace) => {
    const settings = await prisma.workspaceSetting.findMany({ where: { workspaceId: workspace.id } });

    await prisma.workspaceUser.update({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId: user.id,
        },
      },
      data: {
        lastOpened: new Date(),
      },
    });

    return res.json({ data: { ...workspace, WorkspaceSetting: settings } });
  }),
  [HTTPMethod.DELETE]: withWorkspacePermission([Role.ADMIN], async (req, res, user, workspace) => {
    const result = await prisma.workspace.delete({
      where: {
        id: workspace.id,
      },
    });
    return res.json({ data: result });
  }),
  [HTTPMethod.PUT]: withWorkspacePermission([Role.MANAGER], Permission.WORKSPACE_UPDATE, async (req, res, user, workspace) => {
    const { name } = JSON.parse(req.body);
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
