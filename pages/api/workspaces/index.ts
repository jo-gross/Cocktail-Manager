import { NextApiRequest, NextApiResponse } from 'next';
import { Role, User } from '@generated/prisma/client';
import { withAuthentication } from '@middleware/api/authenticationMiddleware';
import HTTPMethod from 'http-method-enum';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { regenerateUnitConversions } from './[workspaceId]/units/conversions';
import { createWorkspaceWithDefaults } from '@lib/workspace/createWorkspaceWithDefaults';
import prisma from '../../../prisma/prisma';

export default withHttpMethods({
  [HTTPMethod.POST]: withAuthentication(async (req: NextApiRequest, res: NextApiResponse, user: User) => {
    if (process.env.DISABLE_WORKSPACE_CREATION === 'true') {
      return res.status(403).json({ message: 'Workspace-Erstellung ist deaktiviert' });
    }

    // Check if user is a demo user (no email) and block workspace creation
    if (!user.email) {
      return res.status(403).json({ message: 'Demo-User können keine Workspaces erstellen' });
    }

    const { name } = req.body;

    const result = await createWorkspaceWithDefaults({
      name: name,
      userId: user.id,
      role: Role.OWNER,
    });

    await regenerateUnitConversions(result.id);

    return res.json({ data: result });
  };),
  [HTTPMethod.GET]: withAuthentication(async (req: NextApiRequest, res: NextApiResponse, user: User) => {
    const result = await prisma.workspace.findMany({
      where: {
        users: {
          some: {
            userId: user.id,
          },
        },
      },
      include: {
        users: true,
      },
    });

    const sortedResult = result.sort(
      (a, b) =>
        (b.users?.find((u) => u.userId == user.id)?.lastOpened || new Date(1970, 1, 1)).getTime() -
        (a.users?.find((u) => u.userId == user.id)?.lastOpened || new Date(1970, 1, 1)).getTime(),
    );

    return res.json({ data: sortedResult });
  }),
})
