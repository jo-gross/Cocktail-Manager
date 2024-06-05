import { withHttpMethods } from '../../../../../middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';
import { withWorkspacePermission } from '../../../../../middleware/api/authenticationMiddleware';
import { Role } from '@prisma/client';
import prisma from '../../../../../prisma/prisma';
import { updateTranslation } from '../admin/translation';

export default withHttpMethods({
  [HTTPMethod.PUT]: withWorkspacePermission([Role.ADMIN], async (req, res, user, workspace) => {
    const actionId = req.query.actionId as string | undefined;
    if (!actionId) return res.status(400).json({ message: 'No action id' });
    const action = await prisma.workspaceCocktailRecipeStepAction.findFirst({ where: { id: actionId } });
    if (action == null) return res.status(404).json({ message: 'Action not found' });

    const { actionGroup, translations } = req.body;

    const actions = await prisma.workspaceCocktailRecipeStepAction.update({ where: { id: actionId }, data: { actionGroup: actionGroup } });

    await updateTranslation(workspace.id, action.name, translations);

    return res.json({ data: actions });
  }),
  [HTTPMethod.DELETE]: withWorkspacePermission([Role.ADMIN], async (req, res, user, workspace) => {
    const actionId = req.query.actionId as string | undefined;
    if (!actionId) return res.status(400).json({ message: 'No action id' });

    const action = await prisma.workspaceCocktailRecipeStepAction.delete({ where: { id: actionId } });
    return res.json({ data: action });
  }),
});
