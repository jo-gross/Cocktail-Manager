import { Permission } from '@generated/prisma/client';

/**
 * Checks if an API key has the required permission for an endpoint
 */
export function hasPermission(
  apiKeyPermissions: Array<{ permission: Permission; endpointPattern?: string | null }>,
  requiredPermission: Permission,
  endpointPath?: string,
): boolean {
  // Check for exact permission match
  const hasExactPermission = apiKeyPermissions.some((p) => p.permission === requiredPermission && !p.endpointPattern);
  if (hasExactPermission) {
    return true;
  }

  // Check for endpoint pattern match if provided
  if (endpointPath) {
    const hasPatternMatch = apiKeyPermissions.some(
      (p) => p.permission === requiredPermission && p.endpointPattern && new RegExp(p.endpointPattern).test(endpointPath),
    );
    if (hasPatternMatch) {
      return true;
    }
  }

  return false;
}
