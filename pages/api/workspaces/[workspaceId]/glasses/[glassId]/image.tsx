import { withHttpMethods } from '@middleware/api/handleMethods';
import { withDeprecation } from '@middleware/api/withDeprecation';
import HTTPMethod from 'http-method-enum';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { Role, Permission } from '@generated/prisma/client';
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../../../../prisma/prisma';

const legacyHandler = withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.USER], Permission.GLASSES_READ, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const glassId = req.query.glassId as string | undefined;
    if (!glassId) return res.status(400).json({ message: 'No glass id' });

    const result = await prisma.glassImage.findFirst({
      where: {
        glassId: glassId,
        glass: {
          workspaceId: workspace.id,
        },
      },
      select: {
        image: true,
      },
    });

    if (result?.image == null) return res.status(404).json({ message: 'No glass image found' });

    const type = result.image.split(';')[0].split(':')[1];
    const decoded = result.image.split(',')[1];
    const imageResp = Buffer.from(decoded, 'base64');

    res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': imageResp.length,
    });
    return res.send(imageResp);
  }),
});

// DEPRECATED: unversioned endpoint kept for backward compatibility. Behavior is
// unchanged; only advertises the successor v1 path. Use /api/v1/... instead.
export default withDeprecation({ successor: '/api/v1/workspaces/{workspaceId}/glasses/{glassId}/image' }, legacyHandler);
