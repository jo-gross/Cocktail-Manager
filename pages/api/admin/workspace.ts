import { NextApiRequest, NextApiResponse } from 'next';
import { withHttpMethods } from '@middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';
import { checkMasterApiKey } from '@middleware/api/jwtApiKeyMiddleware';
import { constants as HttpStatus } from 'http2';
import { regenerateUnitConversions } from '../workspaces/[workspaceId]/units/conversions';
import { createWorkspaceWithDefaults } from '@lib/workspace/createWorkspaceWithDefaults';
import prisma from '../../../prisma/prisma';

export default withHttpMethods({
  [HTTPMethod.POST]: async (req: NextApiRequest, res: NextApiResponse) => {
    // Check master API key
    if (!checkMasterApiKey(req)) {
      return res.status(HttpStatus.HTTP_STATUS_UNAUTHORIZED).json({ message: 'Master API key required' });
    }

    const { name } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(HttpStatus.HTTP_STATUS_BAD_REQUEST).json({ message: 'Workspace name is required' });
    }

    try {
      // Generate unique join code
      let joinCode: string;
      let codeExists = true;
      while (codeExists) {
        joinCode = Math.random().toString(36).slice(2, 8).toLowerCase();
        const existing = await prisma.workspaceJoinCode.findUnique({
          where: { code: joinCode },
        });
        codeExists = !!existing;
      }

      const workspace = await createWorkspaceWithDefaults({
        name: name,
        joinCode: joinCode!,
      });

      await regenerateUnitConversions(workspace.id);

      return res.json({
        data: {
          workspace: {
            id: workspace.id,
            name: workspace.name,
          },
          joinCode: joinCode!,
        },
      });
    } catch (error) {
      console.error('Error creating workspace:', error);
      return res.status(HttpStatus.HTTP_STATUS_INTERNAL_SERVER_ERROR).json({ message: 'Failed to create workspace' });
    }
  },
});

