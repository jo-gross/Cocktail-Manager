import NextAuth, { NextAuthOptions } from 'next-auth';
import { Role } from '@generated/prisma/client';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import prisma from '../../../prisma/prisma';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { AdapterAccount } from 'next-auth/adapters';

const providers: any[] = [];

// Google OAuth Provider
// Required: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
if (process.env.GOOGLE_CLIENT_ID as string) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      httpOptions: {
        timeout: 40000,
      },
    }),
  );
}

// Custom OIDC Provider
// Required: CUSTOM_OIDC_NAME, CUSTOM_OIDC_ISSUER_URL, CUSTOM_OIDC_CLIENT_ID[, CUSTOM_OIDC_CLIENT_SECRET]
if (process.env.CUSTOM_OIDC_NAME as string) {
  providers.push({
    id: 'custom_oidc',
    name: process.env.CUSTOM_OIDC_NAME as string,
    type: 'oauth',
    wellKnown: process.env.CUSTOM_OIDC_ISSUER_URL as string,
    authorization: { params: { scope: process.env.CUSTOM_OIDC_SCOPES || 'openid email profile' } },
    clientId: process.env.CUSTOM_OIDC_CLIENT_ID as string,
    clientSecret: process.env.CUSTOM_OIDC_CLIENT_SECRET as string,
    idToken: true,
    checks: ['pkce', 'state'],
    profile(profile: any) {
      return {
        id: profile[(process.env.CUSTOM_OIDC_ID_KEY as string) || 'sub'],
        name: profile[(process.env.CUSTOM_OIDC_NAME_KEY as string) || 'name'],
        email: profile[(process.env.CUSTOM_OIDC_EMAIL_KEY as string) || 'email'],
      };
    },
  });
}

// Demo Mode Credentials Provider (only enabled when DEMO_MODE is true)
if (process.env.DEMO_MODE === 'true') {
  providers.push(
    Credentials({
      id: 'demo',
      name: 'Demo',
      credentials: {
        userId: { label: 'User ID', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.userId) {
          return null;
        }

        // Find demo user by ID
        const user = await prisma.user.findUnique({
          where: {
            id: credentials.userId as string,
          },
        });

        // Only allow demo users (users without email)
        if (user && !user.email) {
          return {
            id: user.id,
            name: user.name || 'Demo User',
            email: null,
          };
        }

        return null;
      },
    }),
  );
}

// Some providers have custom options in their tokens. This causes problems if these fields are not present in the account db model.
// This is a custom adapter that removes all fields from the account object that are not present in the account model.
// @ts-ignore
const adapter = PrismaAdapter(prisma);
const _linkAccount = adapter.linkAccount;
adapter.linkAccount = (account: AdapterAccount) => {
  const data = { ...account };

  // Remove all fields from data that are not present in the prisma.account model
  for (const field in account) {
    if (!(field in prisma.account.fields)) {
      delete data[field];
    }
  }

  return _linkAccount(data);
};

export const authOptions: NextAuthOptions = {
  theme: {
    logo: '/images/Logo-with-Text.svg',
  },
  providers,
  adapter,
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    session: async ({ session, token }) => {
      if (session?.user) {
        session.user.id = token.uid;
      }
      return session;
    },
    jwt: async ({ user, token, account, profile }) => {
      if (user) {
        token.uid = user.id;

        // Check for External Workspace Management
        if (process.env.EXTERNAL_WORKSPACE_MANAGEMENT === 'true' && account?.provider === 'custom_oidc' && profile) {
          const groupKey = process.env.CUSTOM_OIDC_GROUPS_KEY;
          const mappingsJson = process.env.EXTERNAL_WORKSPACE_MAPPINGS;

          if (groupKey && mappingsJson) {
            try {
              const workspaces = JSON.parse(mappingsJson);
              // @ts-ignore
              const userGroups = profile[groupKey] || [];
              const groupList = Array.isArray(userGroups) ? userGroups : [userGroups];

              if (Array.isArray(workspaces)) {
                for (const workspaceConfig of workspaces) {
                  const { workspaceId, workspaceName, mappings } = workspaceConfig;

                  if (workspaceId && Array.isArray(mappings)) {
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
                            userId: user.id,
                          },
                        },
                        create: {
                          workspaceId: workspace.id,
                          userId: user.id,
                          role: roleToAssign,
                        },
                        update: {
                          role: roleToAssign,
                        },
                      });
                    } else {
                      // User has no role in this workspace based on current groups.
                      // check if user is in workspace and remove if so.
                      // We only remove if the workspace exists.
                      const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
                      if (workspace) {
                        // Check if user is in workspace
                        const workspaceUser = await prisma.workspaceUser.findUnique({
                          where: {
                            workspaceId_userId: {
                              workspaceId: workspace.id,
                              userId: user.id,
                            },
                          },
                        });

                        if (workspaceUser) {
                          await prisma.workspaceUser.delete({
                            where: {
                              workspaceId_userId: {
                                workspaceId: workspace.id,
                                userId: user.id,
                              },
                            },
                          });
                        }
                      }
                    }
                  }
                }
              }
            } catch (e) {
              console.error('Failed to process EXTERNAL_WORKSPACE_MAPPINGS', e);
            }
          }
        }
      }
      return token;
    },
  },
  session: {
    strategy: 'jwt',
  },
};

export default NextAuth(authOptions);
