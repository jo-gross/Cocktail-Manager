/**
 * BetterAuth type declarations
 *
 * This file extends BetterAuth types for the application.
 */

import { auth } from '@lib/auth';

// Export the auth type for client-side usage
export type Auth = typeof auth;

// Session types
export interface BetterAuthSession {
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    emailVerified: boolean;
  };
  session: {
    id: string;
    token: string;
    userId: string;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
    ipAddress: string | null;
    userAgent: string | null;
  };
}
