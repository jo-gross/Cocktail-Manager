import { withHttpMethods } from '../../../../../../middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';
import { withWorkspacePermission } from '../../../../../../middleware/api/authenticationMiddleware';
import { Role } from '@prisma/client';
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../../../../prisma/prisma';

export default withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.USER], async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const glassId = req.query.glassId as string | undefined;
    if (!glassId) return res.status(400).json({ message: 'No glass id' });

    const result = await prisma.glassImage.findFirst({
      where: {
        glassId: glassId,
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
