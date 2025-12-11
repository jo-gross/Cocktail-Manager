import { Permission } from '@generated/prisma/client';

/**
 * Checks if an API key has the required permission
 */
export function hasPermission(apiKeyPermissions: Permission[], requiredPermission: Permission): boolean {
  return apiKeyPermissions.includes(requiredPermission);
}
