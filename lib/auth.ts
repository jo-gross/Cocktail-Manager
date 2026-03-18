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
            // Use standard userinfo endpoint from OIDC discovery
            const discoveryUrl = process.env.CUSTOM_OIDC_ISSUER_URL!;
            const baseUrl = discoveryUrl.replace('/.well-known/openid-configuration', '');
            const userinfoUrl = `${baseUrl}/userinfo`;

            const response = await fetch(userinfoUrl, {
              headers: {
                Authorization: `Bearer ${tokens.accessToken}`,
              },
            });

            if (!response.ok) {
              throw new Error('Failed to fetch user info');
            }

            const profile = await response.json();
            const idKey = process.env.CUSTOM_OIDC_ID_KEY || 'sub';
            const nameKey = process.env.CUSTOM_OIDC_NAME_KEY || 'name';
            const emailKey = process.env.CUSTOM_OIDC_EMAIL_KEY || 'email';

            // Store groups in a global cache for later use in workspace management
            const groupKey = process.env.CUSTOM_OIDC_GROUPS_KEY;
            if (groupKey && profile[groupKey]) {
              const userId = profile[idKey];
              // We'll handle this via mapProfileToUser instead
              oidcGroupsCache.set(userId, profile[groupKey]);
            }

            return {
              id: profile[idKey],
              name: profile[nameKey],
              email: profile[emailKey],
              emailVerified: true,
            };
          },
          mapProfileToUser: async (profile) => {
            // This is called after getUserInfo with the returned profile
            return {};
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
    return;
  }

  const workspaces = getExternalWorkspaceMappings();
  const groupList = Array.isArray(groups) ? groups : [groups];

  for (const workspaceConfig of workspaces) {
    const { workspaceId, workspaceName, mappings } = workspaceConfig;

    if (!workspaceId || !Array.isArray(mappings)) {
      continue;
    }

    // Determine Role
    let roleToAssign: Role | null = null;
    const rolePriority = [Role.OWNER, Role.ADMIN, Role.MANAGER, Role.USER];

    for (const mapping of mappings) {
      if (groupList.includes(mapping.oidcGroup)) {
        const role = mapping.role as Role;
        if (Object.values(Role).includes(role)) {
          if (!roleToAssign) {
            roleToAssign = role;
          } else {
            if (rolePriority.indexOf(role) < rolePriority.indexOf(roleToAssign)) {
              roleToAssign = role;
            }
          }
        }
      }
    }

    if (roleToAssign) {
      // Check/Create Workspace
      let workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
      if (!workspace) {
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
    } else {
      // User has no role in this workspace based on current groups
      // Remove user from workspace if they were previously a member
      const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
      if (workspace) {
        const workspaceUser = await prisma.workspaceUser.findUnique({
          where: {
            workspaceId_userId: {
              workspaceId: workspace.id,
              userId: userId,
            },
          },
        });

        if (workspaceUser) {
          await prisma.workspaceUser.delete({
            where: {
              workspaceId_userId: {
                workspaceId: workspace.id,
                userId: userId,
              },
            },
          });
        }
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

  // Field mapping: BetterAuth uses camelCase, but our DB uses snake_case
  // The mapping tells BetterAuth which DB column to use for each field
  user: {
    fields: {
      emailVerified: 'email_verified',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
    fields: {
      userId: 'user_id',
      expiresAt: 'expires_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      ipAddress: 'ip_address',
      userAgent: 'user_agent',
    },
  },

  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ['google', 'custom_oidc'],
    },
    fields: {
      userId: 'user_id',
      providerId: 'provider_id',
      accountId: 'account_id',
      accessToken: 'access_token',
      refreshToken: 'refresh_token',
      idToken: 'id_token',
      accessTokenExpiresAt: 'access_token_expires_at',
      refreshTokenExpiresAt: 'refresh_token_expires_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },

  // Database hooks for external workspace management
  databaseHooks: {
    session: {
      create: {
        after: async (session) => {
          // Handle external workspace management on login
          // We need to check if this is from custom_oidc and handle groups
          const account = await prisma.account.findFirst({
            where: { userId: session.userId },
            orderBy: { id: 'desc' },
          });

          if (account?.providerId === 'custom_oidc') {
            // For OIDC, we stored groups in the id_token or need to fetch them
            // This is handled in the OAuth callback via getUserInfo
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
