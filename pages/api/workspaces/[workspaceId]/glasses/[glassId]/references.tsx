import prisma from '../../../../../../prisma/prisma';
import { NextApiRequest, NextApiResponse } from 'next';
import HTTPMethod from 'http-method-enum';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { Permission, Role, Workspace } from '@generated/prisma/client';
import { withHttpMethods } from '@middleware/api/handleMethods';

export default withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission(
    [Role.USER],
    Permission.GLASSES_READ,
    async (req: NextApiRequest, res: NextApiResponse, user, workspace: Workspace) => {
      const glassId = req.query.glassId as string | undefined;
      if (!glassId) return res.status(400).json({ message: 'No glass id' });

      // Prüfe, ob das Glas noch in Cocktail-Rezepten verwendet wird
      const cocktails = await prisma.cocktailRecipe.findMany({
        where: {
          glassId: glassId,
          workspaceId: workspace.id,
        },
        select: {
          id: true,
          name: true,
        },
      });

      return res.json({
        data: {
          inUse: cocktails.length > 0,
          cocktails: cocktails,
        },
      });
    },
  ),
});
