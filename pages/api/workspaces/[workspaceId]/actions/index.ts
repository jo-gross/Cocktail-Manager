import { withHttpMethods } from '../../../../../middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';
import { withWorkspacePermission } from '../../../../../middleware/api/authenticationMiddleware';
import { Prisma, Role } from '@prisma/client';
import prisma from '../../../../../lib/prisma';
import { updateTranslation } from '../admin/translation';
import WorkspaceCocktailRecipeStepActionCreateInput = Prisma.WorkspaceCocktailRecipeStepActionCreateInput;

export default withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.USER], async (req, res, user, workspace) => {
    const actions = await prisma.workspaceCocktailRecipeStepAction.findMany({ where: { workspaceId: workspace.id } });
    return res.json({ data: actions });
  }),
  [HTTPMethod.POST]: withWorkspacePermission([Role.ADMIN], async (req, res, user, workspace) => {
    const { name, actionGroup, translations } = req.body;
    const input: WorkspaceCocktailRecipeStepActionCreateInput = {
      name: name,
      actionGroup: actionGroup,
      workspace: {
        connect: {
          id: workspace.id,
        },
      },
    };
    await updateTranslation(workspace.id, name, translations);

    const action = await prisma.workspaceCocktailRecipeStepAction.create({ data: input });
    return res.json({ data: action });
  }),
});
