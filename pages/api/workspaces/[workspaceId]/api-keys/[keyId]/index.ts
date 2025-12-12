import { NextApiRequest, NextApiResponse } from 'next';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { Role, Permission } from '@generated/prisma/client';
import HTTPMethod from 'http-method-enum';
import prisma from '../../../../../../prisma/prisma';
import { invalidateKeyCache } from '@middleware/api/jwtApiKeyMiddleware';

export default withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.ADMIN, Role.OWNER], async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const keyId = req.query.keyId as string | undefined;
    if (!keyId) {
      return res.status(400).json({ message: 'keyId is required' });
    }

    const apiKey = await prisma.workspaceApiKey.findFirst({
      where: {
        id: keyId,
        workspaceId: workspace.id,
      },
      include: {
        permissions: true,
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!apiKey) {
      return res.status(404).json({ message: 'API key not found' });
    }

    return res.json({
      data: {
        id: apiKey.id,
        name: apiKey.name,
        keyId: apiKey.keyId,
        keyPrefix: apiKey.keyId.substring(0, 8) + '...',
        revoked: apiKey.revoked,
        expiresAt: apiKey.expiresAt,
        lastUsedAt: apiKey.lastUsedAt,
        createdAt: apiKey.createdAt,
        createdBy: apiKey.createdByUser,
        permissions: apiKey.permissions.map((p) => p.permission),
      },
    });
  }),

  [HTTPMethod.DELETE]: withWorkspacePermission([Role.ADMIN, Role.OWNER], async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const keyId = req.query.keyId as string | undefined;
    if (!keyId) {
      return res.status(400).json({ message: 'keyId is required' });
    }

    // Verify key belongs to workspace
    const existingKey = await prisma.workspaceApiKey.findFirst({
      where: {
        id: keyId,
        workspaceId: workspace.id,
      },
    });

    if (!existingKey) {
      return res.status(404).json({ message: 'API key not found' });
    }

    // Invalidate cache before deletion
    await invalidateKeyCache(existingKey.keyId);

    // Delete key (permissions will be deleted via cascade)
    await prisma.workspaceApiKey.delete({
      where: { id: keyId },
    });

    return res.json({ message: 'API key deleted successfully' });
  }),
});
