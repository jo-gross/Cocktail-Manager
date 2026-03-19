import { auth, oidcGroupsCache, handleExternalWorkspaceManagement } from '@lib/auth';
import { toNodeHandler } from 'better-auth/node';
import { NextApiRequest, NextApiResponse } from 'next';

// Disable body parsing, BetterAuth handles it
export const config = { api: { bodyParser: false } };

// Custom handler to intercept OAuth callbacks for workspace management
const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  // Check if this is an OAuth callback that might need workspace management
  const isOAuthCallback = req.url?.includes('/oauth2/callback/custom_oidc');

  // Get the base handler
  const baseHandler = toNodeHandler(auth.handler);

  // Wrap the response to intercept after OAuth completes
  if (isOAuthCallback && process.env.EXTERNAL_WORKSPACE_MANAGEMENT === 'true') {
    // Store original methods
    const originalEnd = res.end.bind(res);
    const originalJson = res.json?.bind(res);

    // Override to intercept successful auth
    res.end = function (...args: Parameters<typeof res.end>) {
      // After OAuth callback, check for groups in cache and handle workspace management
      // This is async but we don't await it to not block the response
      (async () => {
        try {
          // Get the session to find the user ID
          const session = await auth.api.getSession({
            headers: new Headers(req.headers as Record<string, string>),
          });

          if (session?.user?.id) {
            const groups = oidcGroupsCache.get(session.user.id);
            if (groups && groups.length > 0) {
              await handleExternalWorkspaceManagement(session.user.id, groups);
              // Clean up cache
              oidcGroupsCache.delete(session.user.id);
            }
          }
        } catch (error) {
          console.error('Error handling external workspace management:', error);
        }
      })();

      return originalEnd.apply(res, args);
    } as typeof res.end;
  }

  return baseHandler(req, res);
};

export default handler;
