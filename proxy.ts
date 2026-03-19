import { NextRequest, NextResponse } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';

/**
 * Next.js 16 Proxy for protecting routes
 *
 * This proxy protects all routes under /workspaces/* by checking for
 * a BetterAuth session cookie. The actual session validation happens
 * in API routes via auth.api.getSession().
 *
 * Note: Cookie-based checks are the recommended approach by BetterAuth
 * for optimistic redirects. Full validation should happen in pages/routes.
 */
export function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);

  if (!sessionCookie) {
    // No session cookie, redirect to home page (which has login)
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Session cookie exists, allow the request
  return NextResponse.next();
}

export const config = {
  matcher: ['/workspaces/:path*'],
};
