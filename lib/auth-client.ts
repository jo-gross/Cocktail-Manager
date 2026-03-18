import { createAuthClient } from 'better-auth/react';
import { genericOAuthClient } from 'better-auth/client/plugins';

// Create the auth client for React
export const authClient = createAuthClient({
  baseURL: typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  plugins: [
    // Generic OAuth client plugin for custom OIDC provider
    genericOAuthClient(),
  ],
});

// Export commonly used methods
export const {
  signIn,
  signOut,
  signUp,
  useSession,
  getSession,
  // OAuth methods
  $Infer,
} = authClient;

// Type for session data
export type Session = typeof authClient.$Infer.Session;
export type User = typeof authClient.$Infer.Session.user;
