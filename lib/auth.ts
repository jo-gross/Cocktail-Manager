import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { genericOAuth } from 'better-auth/plugins';
import prisma from '../prisma/prisma';
import { Role } from '@generated/prisma/client';
import { getExternalWorkspaceMappings } from './config/externalWorkspace';

// Build social providers configuration
const socialProviders: Record<string, { clientId: string; clientSecret: string }> = {};

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  socialProviders.google = {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  };
}

// Build plugins array
const plugins: ReturnType<typeof genericOAuth>[] = [];

// Cache for OIDC discovery data
let oidcDiscoveryCache: { userinfo_endpoint?: string } | null = null;

// Custom OIDC Provider via genericOAuth plugin
if (process.env.CUSTOM_OIDC_NAME && process.env.CUSTOM_OIDC_ISSUER_URL && process.env.CUSTOM_OIDC_CLIENT_ID) {
  plugins.push(
    genericOAuth({
      config: [
        {
          providerId: 'custom_oidc',
          discoveryUrl: process.env.CUSTOM_OIDC_ISSUER_URL,
          clientId: process.env.CUSTOM_OIDC_CLIENT_ID,
          clientSecret: process.env.CUSTOM_OIDC_CLIENT_SECRET || '',
          scopes: (process.env.CUSTOM_OIDC_SCOPES || 'openid email profile').split(' '),
          pkce: true,
          getUserInfo: async (tokens) => {
            const discoveryUrl = process.env.CUSTOM_OIDC_ISSUER_URL!;

            // Fetch discovery document to get userinfo endpoint (with caching)
            if (!oidcDiscoveryCache) {
              const discoveryResponse = await fetch(discoveryUrl);
              if (discoveryResponse.ok) {
                oidcDiscoveryCache = await discoveryResponse.json();
              }
            }

            // Use userinfo endpoint from discovery, or construct fallback
            let userinfoUrl = oidcDiscoveryCache?.userinfo_endpoint;
            if (!userinfoUrl) {
              // Fallback: try to construct from issuer
              const baseUrl = discoveryUrl.replace('/.well-known/openid-configuration', '');
              userinfoUrl = `${baseUrl}/userinfo`;
            }

            console.log('[BetterAuth] Fetching user info from:', userinfoUrl);

            const response = await fetch(userinfoUrl, {
              headers: {
                Authorization: `Bearer ${tokens.accessToken}`,
              },
            });

            if (!response.ok) {
              const errorText = await response.text();
              console.error('[BetterAuth] Failed to fetch user info:', response.status, errorText);
              throw new Error(`Failed to fetch user info: ${response.status} ${errorText}`);
            }

            const profile = await response.json();
            console.log('[BetterAuth] User profile received:', Object.keys(profile));

            const idKey = process.env.CUSTOM_OIDC_ID_KEY || 'sub';
            const nameKey = process.env.CUSTOM_OIDC_NAME_KEY || 'name';
            const emailKey = process.env.CUSTOM_OIDC_EMAIL_KEY || 'email';

            // Store groups in a global cache for later use in workspace management
            const groupKey = process.env.CUSTOM_OIDC_GROUPS_KEY;
            if (groupKey && profile[groupKey]) {
              const userId = profile[idKey];
              oidcGroupsCache.set(userId, profile[groupKey]);
            }

            return {
              id: profile[idKey],
              name: profile[nameKey],
              email: profile[emailKey],
              emailVerified: true,
            };
          },
        },
      ],
    }),
  );
}

// Cache for OIDC groups (used for external workspace management)
const oidcGroupsCache = new Map<string, string[]>();
export { oidcGroupsCache };

// Helper function to handle external workspace management
async function handleExternalWorkspaceManagement(userId: string, groups: string[]) {
  if (process.env.EXTERNAL_WORKSPACE_MANAGEMENT !== 'true') {
    console.log('[ExternalWorkspace] External workspace management is disabled');
    return;
  }

  const workspaces = getExternalWorkspaceMappings();
  const groupList = Array.isArray(groups) ? groups : [groups];

  console.log('[ExternalWorkspace] Processing for user:', userId);
  console.log('[ExternalWorkspace] User groups:', groupList);
  console.log('[ExternalWorkspace] Configured workspaces:', workspaces.length);

  for (const workspaceConfig of workspaces) {
    const { workspaceId, workspaceName, mappings } = workspaceConfig;

    if (!workspaceId || !Array.isArray(mappings)) {
      console.log('[ExternalWorkspace] Skipping invalid workspace config:', workspaceId);
      continue;
    }

    // Determine Role based on user's groups
    let roleToAssign: Role | null = null;
    const rolePriority = [Role.OWNER, Role.ADMIN, Role.MANAGER, Role.USER];

    for (const mapping of mappings) {
      if (groupList.includes(mapping.oidcGroup)) {
        const role = mapping.role as Role;
        if (Object.values(Role).includes(role)) {
          if (!roleToAssign) {
            roleToAssign = role;
          } else {
            // Assign highest priority role
            if (rolePriority.indexOf(role) < rolePriority.indexOf(roleToAssign)) {
              roleToAssign = role;
            }
          }
        }
      }
    }

    console.log('[ExternalWorkspace] Workspace:', workspaceId, '-> Role:', roleToAssign);

    if (roleToAssign) {
      // User has a matching group - add/update them in the workspace
      let workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
      if (!workspace) {
        console.log('[ExternalWorkspace] Creating workspace:', workspaceId);
        workspace = await prisma.workspace.create({
          data: {
            id: workspaceId,
            name: workspaceName || workspaceId,
            isDemo: false,
          },
        });
      }

      // Update/Create WorkspaceUser
      await prisma.workspaceUser.upsert({
        where: {
          workspaceId_userId: {
            workspaceId: workspace.id,
            userId: userId,
          },
        },
        create: {
          workspaceId: workspace.id,
          userId: userId,
          role: roleToAssign,
        },
        update: {
          role: roleToAssign,
        },
      });
      console.log('[ExternalWorkspace] User added/updated in workspace:', workspaceId, 'with role:', roleToAssign);
    } else {
      // User has NO matching group - remove them from the workspace if they exist
      console.log('[ExternalWorkspace] User has no matching group for workspace:', workspaceId);

      const existingMembership = await prisma.workspaceUser.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: workspaceId,
            userId: userId,
          },
        },
      });

      if (existingMembership) {
        console.log('[ExternalWorkspace] Removing user from workspace:', workspaceId);
        await prisma.workspaceUser.delete({
          where: {
            workspaceId_userId: {
              workspaceId: workspaceId,
              userId: userId,
            },
          },
        });
        console.log('[ExternalWorkspace] User removed from workspace:', workspaceId);
      }
    }
  }
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  secret: process.env.BETTER_AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL || process.env.NEXTAUTH_URL,
  trustedOrigins: process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(',') || [],

  socialProviders,
  plugins,

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },

  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ['google', 'custom_oidc'],
    },
  },

  // Database hooks for external workspace management
  databaseHooks: {
    session: {
      create: {
        after: async (session) => {
          // Handle external workspace management on login
          const account = await prisma.account.findFirst({
            where: { userId: session.userId },
            orderBy: { createdAt: 'desc' },
          });

          if (account?.providerId === 'custom_oidc') {
            // Get groups from cache using the provider's account ID (sub)
            const groups = oidcGroupsCache.get(account.accountId) || [];
            console.log('[BetterAuth] Processing external workspace management for user:', session.userId, 'groups:', groups);

            // Always call handleExternalWorkspaceManagement, even with empty groups
            // This ensures users are removed from workspaces if they no longer have matching groups
            await handleExternalWorkspaceManagement(session.userId, groups);

            // Clear cache after processing
            if (oidcGroupsCache.has(account.accountId)) {
              oidcGroupsCache.delete(account.accountId);
            }
          }
        },
      },
    },
  },

  // Advanced configuration for OAuth callbacks
  advanced: {
    crossSubDomainCookies: {
      enabled: false,
    },
  },
});

// Export auth handler and API
export type Auth = typeof auth;

// Helper to get session on the server
export async function getServerSession(headers: Headers) {
  return auth.api.getSession({ headers });
}

// Helper for external workspace management (called after OAuth)
export { handleExternalWorkspaceManagement };
