import prisma from '../../../../../../prisma/prisma';
import { NextApiRequest, NextApiResponse } from 'next';
import HTTPMethod from 'http-method-enum';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { Permission, Role } from '@generated/prisma/client';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { withDeprecation } from '@middleware/api/withDeprecation';

// DELETE /api/glasses/:id

const legacyHandler = withHttpMethods({
  [HTTPMethod.DELETE]: withWorkspacePermission(
    [Role.MANAGER],
    Permission.STATISTICS_DELETE,
    async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
      const cocktailStatisticId = req.query.cocktailStatisticId as string | undefined;
      if (!cocktailStatisticId) return res.status(400).json({ message: 'No cocktail statistic id' });
      const result = await prisma.cocktailStatisticItem.delete({
        where: {
          id: cocktailStatisticId,
          workspaceId: workspace.id,
        },
      });
      return res.json({ data: result });
    },
  ),
});

// DEPRECATED: unversioned endpoint kept for backward compatibility. Behavior is
// unchanged; only advertises the successor v1 path. Use /api/v1/... instead.
export default withDeprecation({ successor: '/api/v1/workspaces/{workspaceId}/statistics/cocktails/{cocktailStatisticId}' }, legacyHandler);
