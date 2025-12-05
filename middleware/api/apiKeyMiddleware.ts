import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../prisma/prisma';
import { WorkspaceApiKey, Workspace, Permission } from '@generated/prisma/client';
import { constants as HttpStatus } from 'http2';
import bcrypt from 'bcrypt';
export interface ApiKeyAuthResult {
  apiKey: WorkspaceApiKey;
  workspace: Workspace;
  permissions: Array<{ permission: Permission; endpointPattern?: string | null }>;
}

/**
 * Extracts API key from Authorization header
 */
function extractApiKey(req: NextApiRequest): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return null;
  }

  // Support both "Bearer <key>" and direct key
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return authHeader;
}

/**
 * Checks if the provided key matches the master API key from environment
 */
export function isMasterApiKey(key: string): boolean {
  const masterKey = process.env.INSTANCE_MASTER_API_KEY;
  if (!masterKey) {
    return false;
  }

  // Direct comparison (master key is stored in plain text in env, not hashed)
  // Use constant-time comparison to prevent timing attacks
  if (key.length !== masterKey.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < key.length; i++) {
    result |= key.charCodeAt(i) ^ masterKey.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Authenticates using API key from Authorization header
 */
export async function authenticateApiKey(req: NextApiRequest): Promise<ApiKeyAuthResult | null> {
  const apiKey = extractApiKey(req);
  if (!apiKey) {
    return null;
  }

  // Check master API key first
  if (isMasterApiKey(apiKey)) {
    // Master key has access to all workspaces - we'll handle this in withWorkspacePermission
    // For now, return null and let the master key handler deal with it
    return null;
  }

  // Load all API keys and compare hashes
  // This is necessary because we can't query by hash directly
  const allKeys = await prisma.workspaceApiKey.findMany({
    include: {
      workspace: true,
      permissions: true,
    },
  });

  // Find matching key by comparing hashes
  for (const keyRecord of allKeys) {
    try {
      if (bcrypt.compareSync(apiKey, keyRecord.keyHash)) {
        // Check expiration
        if (keyRecord.expiresAt && keyRecord.expiresAt < new Date()) {
          return null;
        }

        // Update lastUsedAt
        await prisma.workspaceApiKey.update({
          where: { id: keyRecord.id },
          data: { lastUsedAt: new Date() },
        });

        return {
          apiKey: keyRecord,
          workspace: keyRecord.workspace,
          permissions: keyRecord.permissions.map((p) => ({
            permission: p.permission,
            endpointPattern: p.endpointPattern,
          })),
        };
      }
    } catch (error) {
      // Continue to next key if comparison fails
      continue;
    }
  }

  return null;
}

/**
 * Middleware that authenticates using API key
 */
export function withApiKeyAuthentication(fn: (req: NextApiRequest, res: NextApiResponse, authResult: ApiKeyAuthResult) => void | Promise<void>) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const authResult = await authenticateApiKey(req);
    if (!authResult) {
      return res.status(HttpStatus.HTTP_STATUS_UNAUTHORIZED).json({ message: 'Invalid or expired API key' });
    }

    return fn(req, res, authResult);
  };
}

/**
 * Checks if master API key is provided and valid
 */
export function checkMasterApiKey(req: NextApiRequest): boolean {
  const apiKey = extractApiKey(req);
  if (!apiKey) {
    return false;
  }

  return isMasterApiKey(apiKey);
}
