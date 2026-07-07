import { withHttpMethods } from '@middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { Role, Permission } from '@generated/prisma/client';
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../../../../prisma/prisma';
import { withDeprecation } from '@middleware/api/withDeprecation';

const legacyHandler = withHttpMethods({
  [HTTPMethod.PUT]: withWorkspacePermission([Role.MANAGER], Permission.COCKTAILS_UPDATE, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const { cocktailId } = req.query;

    if (!cocktailId) return res.status(400).json({ message: 'No cocktail id' });

    const result = await prisma.cocktailRecipe.update({
      where: {
        id: cocktailId as string,
        workspaceId: workspace.id,
      },
      data: {
        isArchived: true,
      },
    });

    return res.status(200).json({ data: result });
  }),
});

// DEPRECATED: unversioned endpoint kept for backward compatibility. Behavior is
// unchanged; only advertises the successor v1 path. Use /api/v1/... instead.
export default withDeprecation({ successor: '/api/v1/workspaces/{workspaceId}/cocktails/{cocktailId}/archive' }, legacyHandler);
