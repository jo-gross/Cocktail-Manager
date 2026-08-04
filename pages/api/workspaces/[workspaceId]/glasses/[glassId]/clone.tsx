import { withHttpMethods } from '@middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { Role, Permission } from '@generated/prisma/client';
import { NextApiRequest, NextApiResponse } from 'next';
import { withDeprecation } from '@middleware/api/withDeprecation';
import prisma from '../../../../../../prisma/prisma';

const legacyHandler = withHttpMethods({
  [HTTPMethod.POST]: withWorkspacePermission([Role.MANAGER], Permission.GLASSES_CREATE, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const glassId = req.query.glassId as string | undefined;
    if (!glassId) return res.status(400).json({ message: 'No glass id' });
    const { name } = req.body;

    return prisma.$transaction(async (transaction) => {
      const existing = await transaction.glass.findFirst({
        where: {
          id: glassId,
          workspaceId: workspace.id,
        },
        include: {
          GlassImage: {
            select: {
              image: true,
            },
          },
        },
      });

      if (!existing) return res.status(404).json({ message: 'Glass not found' });

      // Erstelle den neuen Glass
      const createClone = await transaction.glass.create({
        data: {
          name: name,
          deposit: existing.deposit,
          volume: existing.volume,
          workspace: { connect: { id: workspace.id } },
        },
      });

      // Kopiere das Bild
      if (existing.GlassImage && existing.GlassImage.length > 0) {
        await transaction.glassImage.create({
          data: {
            glassId: createClone.id,
            image: existing.GlassImage[0].image,
          },
        });
      }

      return res.json({ data: createClone });
    });
  }),
});

// DEPRECATED: unversioned endpoint kept for backward compatibility. Behavior is
// unchanged; only advertises the successor v1 path. Use /api/v1/... instead.
export default withDeprecation({ successor: '/api/v1/workspaces/{workspaceId}/glasses/{glassId}/clone' }, legacyHandler);
