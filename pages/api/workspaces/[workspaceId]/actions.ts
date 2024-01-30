import { withHttpMethods } from '../../../../middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';
import { withWorkspacePermission } from '../../../../middleware/api/authenticationMiddleware';
import { Role } from '@prisma/client';
import prisma from '../../../../lib/prisma';

export default withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.USER], async (req, res, user, workspace) => {
    const actions = await prisma.workspaceCocktailRecipeStepAction.findMany({ where: { workspaceId: workspace.id } });
    return res.json({ data: actions });
  }),
});
