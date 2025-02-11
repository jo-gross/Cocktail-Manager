import NextAuth, { NextAuthOptions } from 'next-auth';
import Google from 'next-auth/providers/google';
import prisma from '../../../prisma/prisma';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { OAuthConfig } from 'next-auth/providers';

const providers: OAuthConfig<any>[] = [];

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
    profile(profile) {
      return {
        id: profile[(process.env.CUSTOM_OIDC_ID_KEY as string) || 'sub'],
        name: profile[(process.env.CUSTOM_OIDC_NAME_KEY as string) || 'name'],
        email: profile[(process.env.CUSTOM_OIDC_EMAIL_KEY as string) || 'email'],
      };
    },
  });
}

export const authOptions: NextAuthOptions = {
  theme: {
    logo: '/images/Logo.svg',
  },
  providers,
  adapter: PrismaAdapter(prisma),
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    session: async ({ session, token }) => {
      if (session?.user) {
        session.user.id = token.uid;
      }
      return session;
    },
    jwt: async ({ user, token }) => {
      if (user) {
        token.uid = user.id;
      }
      return token;
    },
  },
  session: {
    strategy: 'jwt',
  },
};

export default NextAuth(authOptions);
