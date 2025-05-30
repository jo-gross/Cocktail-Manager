import HTTPMethod from 'http-method-enum';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { Role } from '@generated/prisma/client';
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../../../prisma/prisma';
import { withHttpMethods } from '@middleware/api/handleMethods';

export default withHttpMethods({
  [HTTPMethod.POST]: withWorkspacePermission([Role.USER], async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
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
