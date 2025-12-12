import prisma from '../../../../../../prisma/prisma';
import { NextApiRequest, NextApiResponse } from 'next';
import HTTPMethod from 'http-method-enum';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { Permission, Role } from '@generated/prisma/client';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { updateTranslation } from '../../admin/translation';

// DELETE /api/glasses/:id

export default withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.USER], Permission.ICE_READ, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const iceId = req.query.iceId as string | undefined;
    if (!iceId) return res.status(400).json({ message: 'No ice id' });

    const result = await prisma.ice.findUnique({
      where: {
        id: iceId,
        workspaceId: workspace.id,
      },
    });
    return res.json({ data: result });
  }),
  [HTTPMethod.PUT]: withWorkspacePermission([Role.MANAGER], Permission.ICE_UPDATE, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const iceId = req.query.iceId as string | undefined;
    if (!iceId) return res.status(400).json({ message: 'No ice id' });

    const { name, translations } = req.body;
    const result = await prisma.ice.update({
      where: {
        id: iceId,
        workspaceId: workspace.id,
      },
      data: {
        name: name,
      },
    });

    // Update translations if provided
    if (translations) {
      await updateTranslation(workspace.id, name, translations);
    }

    return res.json({ data: result });
  }),
  [HTTPMethod.DELETE]: withWorkspacePermission([Role.ADMIN], Permission.ICE_DELETE, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const iceId = req.query.iceId as string | undefined;
    if (!iceId) return res.status(400).json({ message: 'No ice id' });
    const result = await prisma.ice.delete({
      where: {
        id: iceId,
        workspaceId: workspace.id,
      },
    });
    return res.json({ data: result });
  }),
});
