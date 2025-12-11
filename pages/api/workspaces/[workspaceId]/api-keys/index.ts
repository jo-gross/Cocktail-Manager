import { NextApiRequest, NextApiResponse } from 'next';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { Role, Permission } from '@generated/prisma/client';
import HTTPMethod from 'http-method-enum';
import prisma from '../../../../../prisma/prisma';
import crypto from 'crypto';
import { createApiKeyJwt } from '@middleware/api/jwtApiKeyMiddleware';
import { invalidateKeyCache } from '@middleware/api/jwtApiKeyMiddleware';

export default withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.ADMIN, Role.OWNER], async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const apiKeys = await prisma.workspaceApiKey.findMany({
      where: {
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
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Return keys with keyId prefix for identification
    const sanitizedKeys = apiKeys.map((key) => ({
      id: key.id,
      name: key.name,
      keyId: key.keyId,
      keyPrefix: key.keyId.substring(0, 8) + '...',
      revoked: key.revoked,
      expiresAt: key.expiresAt,
      lastUsedAt: key.lastUsedAt,
      createdAt: key.createdAt,
      createdBy: key.createdByUser,
      permissions: key.permissions.map((p) => p.permission),
    }));

    return res.json({ data: sanitizedKeys });
  }),

  [HTTPMethod.POST]: withWorkspacePermission([Role.ADMIN, Role.OWNER], async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const { name, expiresAt, permissions } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ message: 'Name is required' });
    }

    // Generate unique keyId
    const keyId = crypto.randomBytes(16).toString('hex');

    // Validate and parse permissions
    const permissionList: Permission[] = [];

    if (permissions && Array.isArray(permissions)) {
      for (const perm of permissions) {
        if (typeof perm === 'string') {
          // Direct permission string
          permissionList.push(perm as Permission);
        } else if (perm && perm.permission) {
          // Object with permission property (backward compatibility)
          permissionList.push(perm.permission as Permission);
        }
      }
    }

    const expiresAtDate = expiresAt ? new Date(expiresAt) : null;

    // Create API key record
    const createdKey = await prisma.workspaceApiKey.create({
      data: {
        name,
        keyId,
        revoked: false,
        expiresAt: expiresAtDate,
        workspaceId: workspace.id,
        createdByUserId: user.id,
        permissions: {
          create: permissionList.map((permission) => ({ permission })),
        },
      },
      include: {
        permissions: true,
      },
    });

    // Generate JWT token
    const apiKeyToken = createApiKeyJwt(
      keyId,
      workspace.id,
      permissionList,
      expiresAtDate,
    );

    // Return the JWT token only once - client must save it immediately
    return res.json({
      data: {
        id: createdKey.id,
        name: createdKey.name,
        key: apiKeyToken, // JWT token - only returned once!
        expiresAt: createdKey.expiresAt,
        createdAt: createdKey.createdAt,
        permissions: createdKey.permissions.map((p) => p.permission),
      },
    });
  }),
});
