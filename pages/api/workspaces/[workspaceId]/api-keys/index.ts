import { NextApiRequest, NextApiResponse } from 'next';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { Role, Permission } from '@generated/prisma/client';
import HTTPMethod from 'http-method-enum';
import prisma from '../../../../../prisma/prisma';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

/**
 * Generates a new API key
 * Format: ck_<base64 encoded random bytes>
 */
function generateApiKey(): string {
  const randomBytes = crypto.randomBytes(32);
  const base64 = randomBytes.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `ck_${base64}`;
}

/**
 * Hashes an API key using bcrypt
 */
async function hashApiKey(key: string): Promise<string> {
  return bcrypt.hash(key, 10);
}

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

    // Return keys without the full hash, only show a prefix for identification
    const sanitizedKeys = apiKeys.map((key) => ({
      id: key.id,
      name: key.name,
      keyPrefix: key.keyHash.substring(0, 8) + '...',
      expiresAt: key.expiresAt,
      lastUsedAt: key.lastUsedAt,
      createdAt: key.createdAt,
      createdBy: key.createdByUser,
      permissions: key.permissions.map((p) => ({
        permission: p.permission,
        endpointPattern: p.endpointPattern,
      })),
    }));

    return res.json({ data: sanitizedKeys });
  }),

  [HTTPMethod.POST]: withWorkspacePermission([Role.ADMIN, Role.OWNER], async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const { name, expiresAt, permissions } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ message: 'Name is required' });
    }

    // Generate API key
    const apiKey = generateApiKey();
    const keyHash = await hashApiKey(apiKey);

    // Validate and parse permissions
    const permissionEntries: Array<{ permission: Permission; endpointPattern?: string | null }> = [];

    if (permissions && Array.isArray(permissions)) {
      for (const perm of permissions) {
        if (perm.permission) {
          permissionEntries.push({
            permission: perm.permission as Permission,
            endpointPattern: perm.endpointPattern || null,
          });
        }
      }
    }

    // Create API key
    const createdKey = await prisma.workspaceApiKey.create({
      data: {
        name,
        keyHash,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        workspaceId: workspace.id,
        createdByUserId: user.id,
        permissions: {
          create: permissionEntries,
        },
      },
      include: {
        permissions: true,
      },
    });

    // Return the key only once - client must save it immediately
    return res.json({
      data: {
        id: createdKey.id,
        name: createdKey.name,
        key: apiKey, // Only returned once!
        expiresAt: createdKey.expiresAt,
        createdAt: createdKey.createdAt,
        permissions: createdKey.permissions.map((p) => ({
          permission: p.permission,
          endpointPattern: p.endpointPattern,
        })),
      },
    });
  }),
});
