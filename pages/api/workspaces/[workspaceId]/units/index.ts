import { withHttpMethods } from '../../../../../middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';
import { withWorkspacePermission } from '../../../../../middleware/api/authenticationMiddleware';
import { Prisma, Role } from '@prisma/client';
import prisma from '../../../../../lib/prisma';
import { updateTranslation } from '../admin/translation';
import UnitCreateInput = Prisma.UnitCreateInput;

export default withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.USER], async (req, res, user, workspace) => {
    const actions = await prisma.unit.findMany({ where: { workspaceId: workspace.id } });
    return res.json({ data: actions });
  }),
  [HTTPMethod.POST]: withWorkspacePermission([Role.ADMIN], async (req, res, user, workspace) => {
    const { name, translations } = req.body;
    const input: UnitCreateInput = {
      name: name,
      workspace: {
        connect: {
          id: workspace.id,
        },
      },
    };
    await updateTranslation(workspace.id, name, translations);

    const action = await prisma.unit.create({ data: input });
    return res.json({ data: action });
  }),
});
