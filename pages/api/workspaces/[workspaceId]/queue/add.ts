import HTTPMethod from 'http-method-enum';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { Prisma, Role, Permission } from '@generated/prisma/client';
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../../../prisma/prisma';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { withDeprecation } from '@middleware/api/withDeprecation';
import CocktailQueueCreateInput = Prisma.CocktailQueueCreateInput;

const legacyHandler = withHttpMethods({
  [HTTPMethod.POST]: withWorkspacePermission([Role.USER], Permission.QUEUE_CREATE, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const { cocktailId, notes, amount } = req.body;

    const input: CocktailQueueCreateInput = {
      workspace: {
        connect: {
          id: workspace.id,
        },
      },
      cocktail: {
        connect: {
          id: cocktailId,
        },
      },
      notes: notes ? (notes.trim() == '' || notes.trim() == '-' ? undefined : notes.trim()) : undefined,
    };

    const results = [];
    for (let i = 0; i < (amount ?? 1); i++) {
      const result = await prisma.cocktailQueue.create({
        data: input,
      });
      results.push(result);
    }

    return res.json({ data: results });
  }),
});

// DEPRECATED: unversioned endpoint kept for backward compatibility. Behavior is
// unchanged; only advertises the successor v1 path. Use /api/v1/... instead.
export default withDeprecation({ successor: '/api/v1/workspaces/{workspaceId}/queue/add' }, legacyHandler);
