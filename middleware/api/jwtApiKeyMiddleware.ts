import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import Keyv from 'keyv';
import prisma from '../../prisma/prisma';
import { WorkspaceApiKey, Workspace, Permission } from '@generated/prisma/client';
import { constants as HttpStatus } from 'http2';

export interface ApiKeyJwtPayload {
  keyId: string;
  workspaceId: string;
  permissions: Permission[];
  iat: number;
  exp?: number;
}

export interface ApiKeyAuthResult {
  apiKey: WorkspaceApiKey;
  workspace: Workspace;
  permissions: Permission[];
}

// Cache for revoked keys (configurable TTL via API_KEY_REVOKED_CACHE_TTL_MINUTES, default: 15 minutes)
const getRevokedKeysCacheTtl = (): number => {
  const ttlMinutes = process.env.API_KEY_REVOKED_CACHE_TTL_MINUTES;
  if (ttlMinutes) {
    const parsed = parseInt(ttlMinutes, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed * 60 * 1000; // Convert minutes to milliseconds
    }
  }
  return 15 * 60 * 1000; // Default: 15 minutes in milliseconds
};

const revokedKeysCache = new Keyv({ ttl: getRevokedKeysCacheTtl() });

/**
 * Gets JWT secret from environment
 */
function getJwtSecret(): string {
  const secret = process.env.API_KEY_JWT_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('API_KEY_JWT_SECRET or NEXTAUTH_SECRET must be set');
  }
  return secret;
}

/**
 * Extracts API key (JWT) from Authorization header
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
 * Checks if a key is revoked (with caching)
 */
async function isKeyRevoked(keyId: string): Promise<boolean> {
  // Check cache first
  const cached = await revokedKeysCache.get(`api-key:revoked:${keyId}`);
  if (cached !== undefined) {
    return cached === true;
  }

  // Check database
  const key = await prisma.workspaceApiKey.findUnique({
    where: { keyId },
    select: { revoked: true },
  });

  const isRevoked = key?.revoked ?? true; // If key not found, consider it revoked

  // Cache the result
  await revokedKeysCache.set(`api-key:revoked:${keyId}`, isRevoked);

  return isRevoked;
}

/**
 * Invalidates the cache for a specific key
 */
export async function invalidateKeyCache(keyId: string): Promise<void> {
  await revokedKeysCache.delete(`api-key:revoked:${keyId}`);
}

/**
 * Authenticates using JWT-based API key from Authorization header
 */
export async function authenticateApiKey(req: NextApiRequest): Promise<ApiKeyAuthResult | null> {
  const apiKeyToken = extractApiKey(req);
  if (!apiKeyToken) {
    return null;
  }

  // Check master API key first (before JWT verification)
  if (isMasterApiKey(apiKeyToken)) {
    // Master key has access to all workspaces - we'll handle this in withWorkspacePermission
    // For now, return null and let the master key handler deal with it
    return null;
  }

  try {
    // Verify JWT signature (no DB query needed!)
    const secret = getJwtSecret();
    const decoded = jwt.verify(apiKeyToken, secret) as ApiKeyJwtPayload;

    // Check expiration (from JWT exp claim)
    if (decoded.exp && decoded.exp < Date.now() / 1000) {
      return null;
    }

    // Check if key is revoked (with caching)
    if (await isKeyRevoked(decoded.keyId)) {
      return null;
    }

    // Load key from DB (only once, for workspace and lastUsedAt update)
    const keyRecord = await prisma.workspaceApiKey.findUnique({
      where: { keyId: decoded.keyId },
      include: {
        workspace: true,
      },
    });

    if (!keyRecord) {
      return null;
    }

    // Check expiration from DB (in case it was changed after token creation)
    if (keyRecord.expiresAt && keyRecord.expiresAt < new Date()) {
      return null;
    }

    // Verify workspace matches
    if (keyRecord.workspaceId !== decoded.workspaceId) {
      return null;
    }

    // Update lastUsedAt (async, don't wait)
    prisma.workspaceApiKey
      .update({
        where: { id: keyRecord.id },
        data: { lastUsedAt: new Date() },
      })
      .catch((err) => {
        console.error('Failed to update lastUsedAt:', err);
      });

    return {
      apiKey: keyRecord,
      workspace: keyRecord.workspace,
      permissions: decoded.permissions,
    };
  } catch (error) {
    // JWT verification failed (invalid signature, expired, etc.)
    return null;
  }
}

/**
 * Creates a JWT token for an API key
 */
export function createApiKeyJwt(
  keyId: string,
  workspaceId: string,
  permissions: Permission[],
  expiresAt?: Date | null,
): string {
  const secret = getJwtSecret();
  const payload: ApiKeyJwtPayload = {
    keyId,
    workspaceId,
    permissions,
    iat: Math.floor(Date.now() / 1000),
  };

  // Add expiration if provided
  if (expiresAt) {
    payload.exp = Math.floor(expiresAt.getTime() / 1000);
  }

  return jwt.sign(payload, secret, {
    algorithm: 'HS256',
  });
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
 * Checks if master API key is provided and valid
 */
export function checkMasterApiKey(req: NextApiRequest): boolean {
  const apiKey = extractApiKey(req);
  if (!apiKey) {
    return false;
  }

  return isMasterApiKey(apiKey);
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

