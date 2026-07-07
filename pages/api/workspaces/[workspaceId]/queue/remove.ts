import HTTPMethod from 'http-method-enum';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { Role, Permission } from '@generated/prisma/client';
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../../../prisma/prisma';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { withDeprecation } from '@middleware/api/withDeprecation';

const legacyHandler = withHttpMethods({
  [HTTPMethod.POST]: withWorkspacePermission([Role.USER], Permission.QUEUE_DELETE, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const { cocktailId, notes } = req.body;

    const notesTrimmed = notes ? (notes.trim() == '' || notes.trim() == '-' ? null : notes.trim()) : null;

    const firstQueueItem = await prisma.cocktailQueue.findFirst({
      where: {
        workspaceId: workspace.id,
        cocktailId: cocktailId,
        notes: notesTrimmed,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (firstQueueItem) {
      const result = await prisma.cocktailQueue.delete({ where: { id: firstQueueItem.id } });
      return res.json({ data: result });
    } else {
      return res.status(400).json({ message: 'No cocktail in queue' });
    }
  }),
});

// DEPRECATED: unversioned endpoint kept for backward compatibility. Behavior is
// unchanged; only advertises the successor v1 path. Use /api/v1/... instead.
export default withDeprecation({ successor: '/api/v1/workspaces/{workspaceId}/queue/remove' }, legacyHandler);
