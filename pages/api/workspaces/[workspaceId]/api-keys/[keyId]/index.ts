import { NextApiRequest, NextApiResponse } from 'next';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { Role, Permission } from '@generated/prisma/client';
import HTTPMethod from 'http-method-enum';
import prisma from '../../../../../../prisma/prisma';

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
        keyPrefix: apiKey.keyHash.substring(0, 8) + '...',
        expiresAt: apiKey.expiresAt,
        lastUsedAt: apiKey.lastUsedAt,
        createdAt: apiKey.createdAt,
        createdBy: apiKey.createdByUser,
        permissions: apiKey.permissions.map((p) => ({
          permission: p.permission,
          endpointPattern: p.endpointPattern,
        })),
      },
    });
  }),

  [HTTPMethod.PUT]: withWorkspacePermission([Role.ADMIN, Role.OWNER], async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const keyId = req.query.keyId as string | undefined;
    if (!keyId) {
      return res.status(400).json({ message: 'keyId is required' });
    }

    const { name, expiresAt, permissions } = req.body;

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

    // Update key
    const updateData: any = {};
    if (name !== undefined) {
      updateData.name = name;
    }
    if (expiresAt !== undefined) {
      updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;
    }

    // Update permissions if provided
    if (permissions !== undefined && Array.isArray(permissions)) {
      // Delete existing permissions
      await prisma.apiKeyPermission.deleteMany({
        where: {
          apiKeyId: keyId,
        },
      });

      // Create new permissions
      const permissionEntries: Array<{ permission: Permission; endpointPattern?: string | null }> = [];
      for (const perm of permissions) {
        if (perm.permission) {
          permissionEntries.push({
            permission: perm.permission as Permission,
            endpointPattern: perm.endpointPattern || null,
          });
        }
      }

      updateData.permissions = {
        create: permissionEntries,
      };
    }

    const updatedKey = await prisma.workspaceApiKey.update({
      where: { id: keyId },
      data: updateData,
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

    return res.json({
      data: {
        id: updatedKey.id,
        name: updatedKey.name,
        keyPrefix: updatedKey.keyHash.substring(0, 8) + '...',
        expiresAt: updatedKey.expiresAt,
        lastUsedAt: updatedKey.lastUsedAt,
        createdAt: updatedKey.createdAt,
        createdBy: updatedKey.createdByUser,
        permissions: updatedKey.permissions.map((p) => ({
          permission: p.permission,
          endpointPattern: p.endpointPattern,
        })),
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

    // Delete key (permissions will be deleted via cascade)
    await prisma.workspaceApiKey.delete({
      where: { id: keyId },
    });

    return res.json({ message: 'API key deleted successfully' });
  }),
});
