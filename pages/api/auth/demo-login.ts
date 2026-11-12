import { randomBytes, randomUUID } from 'crypto';
import { NextApiRequest, NextApiResponse } from 'next';
import HTTPMethod from 'http-method-enum';
import { z } from 'zod';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { lockWorkspaceScope, runTx } from '@lib/db/tx';
import { ApiError } from '@lib/http/ApiError';
import { sendFail } from '@lib/http/responses';
import { applyRateLimit, getClientIp, TokenBucketRateLimiter } from '@lib/http/rateLimit';
import { verifyDemoLoginToken } from '@lib/demo/loginToken';

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const DemoLoginBodySchema = z.object({
  /** Token returned by `/api/demo/create-workspace`. */
  loginToken: z.string().min(1).max(512),
  /** Optional, must match the token's user. */
  userId: z.string().min(1).max(128).optional(),
});

const demoLoginLimiter = new TokenBucketRateLimiter({ capacity: 20, refillPerSecond: 20 / 600 });

/**
 * Demo login: creates a better-auth session for the demo user a valid, unexpired
 * login token was issued to. Only users without e-mail that own a live demo
 * workspace can log in this way, and only once (the token is rejected when the
 * user already has a session).
 */
export default withHttpMethods({
  [HTTPMethod.POST]: async (req: NextApiRequest, res: NextApiResponse) => {
    if (process.env.DEMO_MODE !== 'true') {
      return sendFail(res, 404, 'DEMO_DISABLED', 'Demo mode is not enabled');
    }
    if (!applyRateLimit(demoLoginLimiter, req, res, 'demo-login')) return;

    const parsed = DemoLoginBodySchema.safeParse(req.body);
    if (!parsed.success) return sendFail(res, 400, 'VALIDATION_ERROR', 'Invalid request body', parsed.error.issues);

    const userId = verifyDemoLoginToken(parsed.data.loginToken);
    if (!userId || (parsed.data.userId && parsed.data.userId !== userId)) {
      return sendFail(res, 401, 'INVALID_LOGIN_TOKEN', 'Invalid or expired demo login token');
    }

    const now = new Date();
    const session = await runTx(async (tx) => {
      // Serializes concurrent logins with the same token (single use).
      await lockWorkspaceScope(tx, userId, 'demo-login');
      const user = await tx.user.findFirst({ where: { id: userId, email: null }, select: { id: true, name: true } });
      const demoWorkspace = user
        ? await tx.workspace.findFirst({
            where: { isDemo: true, demoUserId: userId, expiresAt: { gt: now }, users: { some: { userId } } },
            select: { expiresAt: true },
          })
        : null;
      if (!user || !demoWorkspace?.expiresAt) throw new ApiError(401, 'INVALID_LOGIN_TOKEN', 'Invalid or expired demo login token');
      if ((await tx.session.count({ where: { userId } })) > 0) {
        throw new ApiError(401, 'INVALID_LOGIN_TOKEN', 'Demo login token has already been used');
      }

      const expiresAt = new Date(Math.min(now.getTime() + SESSION_TTL_MS, demoWorkspace.expiresAt.getTime()));
      const created = await tx.session.create({
        data: {
          id: randomUUID(),
          token: randomBytes(32).toString('base64url'),
          userId,
          expiresAt,
          ipAddress: getClientIp(req),
          userAgent: req.headers['user-agent']?.slice(0, 512) || null,
        },
      });
      return { user, session: created };
    });

    // better-auth's default cookie name; the session fallback in authenticationMiddleware reads it.
    const cookieName = 'better-auth.session_token';
    const isSecure = process.env.NODE_ENV === 'production';
    res.setHeader(
      'Set-Cookie',
      `${cookieName}=${session.session.token}; Path=/; HttpOnly; SameSite=Lax; Expires=${session.session.expiresAt.toUTCString()}${isSecure ? '; Secure' : ''}`,
    );

    return res.status(200).json({
      success: true,
      user: { id: session.user.id, name: session.user.name, email: null },
      session: { expiresAt: session.session.expiresAt },
    });
  },
});
