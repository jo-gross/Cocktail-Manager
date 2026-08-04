// pages/api/post/index.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { Permission, Role } from '@generated/prisma/client';
import HTTPMethod from 'http-method-enum';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { withDeprecation } from '@middleware/api/withDeprecation';
import prisma from '../../../../../../../../prisma/prisma';

const legacyHandler = withHttpMethods({
  [HTTPMethod.DELETE]: withWorkspacePermission(
    [Role.MANAGER],
    Permission.RATINGS_DELETE,
    async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
      const { cocktailId: _cocktailId, ratingId } = req.query;
      // Verify that the rating belongs to a cocktail in this workspace
      const rating = await prisma.cocktailRating.findFirst({
        where: {
          id: ratingId as string,
          cocktail: {
            workspaceId: workspace.id,
          },
        },
      });
      if (!rating) {
        return res.status(404).json({ message: 'Rating not found' });
      }
      const deleteResult = await prisma.cocktailRating.delete({
        where: {
          id: ratingId as string,
        },
      });

      return res.json({ data: deleteResult });
    },
  ),
});

// DEPRECATED: unversioned endpoint kept for backward compatibility. Behavior is
// unchanged; only advertises the successor v1 path. Use /api/v1/... instead.
export default withDeprecation({ successor: '/api/v1/workspaces/{workspaceId}/cocktails/{cocktailId}/ratings/{ratingId}' }, legacyHandler);
