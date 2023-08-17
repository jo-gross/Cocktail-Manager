import prisma from '../../../../lib/prisma';
import { withPermission, withWorkspacePermission } from '../../../../middleware/authenticationMiddleware';
import { Role } from '@prisma/client';

export default withWorkspacePermission([Role.USER], async (req, res, user, workspace) => {
  if (req.method === 'GET') {
    const result = await prisma.workspace.findFirst({
      where: {
        users: {
          some: {
            userId: user.id,
          },
        },
      },
    });

    return res.json(result);
  } else if (req.method === 'DELETE') {
    await withPermission(req, res, [Role.ADMIN]);
    const result = await prisma.workspace.delete({
      where: {
        id: workspace.id,
      },
    });
    console.log(result);
    return res.json(result);
  } else if (req.method === 'PUT') {
    await withPermission(req, res, [Role.ADMIN]);

    console.log('Has permissions');
    const { name } = req.body;
    const result = await prisma.workspace.update({
      where: {
        id: workspace.id,
      },
      data: {
        name: name,
      },
    });
    return res.json(result);
  }

  return res.status(400).json({ message: 'Method not supported' });
});
