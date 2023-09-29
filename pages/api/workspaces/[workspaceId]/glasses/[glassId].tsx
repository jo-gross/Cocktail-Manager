import prisma from '../../../../../lib/prisma';
import { NextApiRequest, NextApiResponse } from 'next';
import HTTPMethod from 'http-method-enum';
import { withWorkspacePermission } from '../../../../../middleware/api/authenticationMiddleware';
import { Prisma, Role } from '@prisma/client';
import { withHttpMethods } from '../../../../../middleware/api/handleMethods';
import GlassUpdateInput = Prisma.GlassUpdateInput;

// DELETE /api/glasses/:id

export default withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.USER], async (req: NextApiRequest, res: NextApiResponse) => {
    const glassId = req.query.glassId as string | undefined;
    if (!glassId) return res.status(400).json({ message: 'No glass id' });

    const result = await prisma.glass.findUnique({
      where: {
        id: glassId,
      },
    });
    return res.json({ data: result });
  }),
  [HTTPMethod.DELETE]: withWorkspacePermission([Role.ADMIN], async (req: NextApiRequest, res: NextApiResponse) => {
    const glassId = req.query.glassId as string | undefined;
    if (!glassId) return res.status(400).json({ message: 'No glass id' });
    const result = await prisma.glass.delete({
      where: {
        id: glassId,
      },
    });
    return res.json({ data: result });
  }),
  [HTTPMethod.PUT]: withWorkspacePermission(
    [Role.MANAGER],
    async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
      const glassId = req.query.glassId as string | undefined;
      if (!glassId) return res.status(400).json({ message: 'No glass id' });

      const { name, image, deposit, volume } = req.body;
      const input: GlassUpdateInput = {
        id: glassId,
        name: name,
        volume: volume,
        image: image,
        deposit: deposit,
        workspace: {
          connect: {
            id: workspace.id,
          },
        },
      };
      const result = await prisma.glass.update({
        where: {
          id: glassId,
        },
        data: input,
      });
      return res.json({ data: result });
    },
  ),
});
