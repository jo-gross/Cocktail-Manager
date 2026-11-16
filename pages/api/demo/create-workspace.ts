import { NextApiRequest, NextApiResponse } from 'next';
import HTTPMethod from 'http-method-enum';
import { z } from 'zod';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { applyRateLimit, TokenBucketRateLimiter } from '@lib/http/rateLimit';
import { sendFail } from '@lib/http/responses';
import { normalizeLocale } from '@lib/i18n/locales';
import { isDemoMode } from '@lib/demo/config';
import { createDemoLoginToken } from '@lib/demo/loginToken';
import { createDemoWorkspace, DEMO_MODES } from '@lib/demo/createDemoWorkspace';

/** Public and unauthenticated: a few demo workspaces per client IP and hour. */
const createDemoLimiter = new TokenBucketRateLimiter({ capacity: 5, refillPerSecond: 5 / 3600 });

const CreateDemoBodySchema = z
  .object({
    /** Visitor's UI language (content, names); unsupported values fall back to the default. */
    locale: z.string().max(35).optional(),
    /** `full`: ready-to-use sample bar; `setup`: empty workspace in the setup assistant. */
    mode: z.enum(DEMO_MODES).default('full'),
  })
  .default({ mode: 'full' });

/**
 * Creates a demo user and a demo workspace (one transaction) and returns a
 * short-lived `loginToken` for `/api/auth/demo-login`.
 */
export default withHttpMethods({
  [HTTPMethod.POST]: async (req: NextApiRequest, res: NextApiResponse) => {
    if (!isDemoMode()) {
      return sendFail(res, 403, 'DEMO_DISABLED', 'Demo mode is not enabled');
    }
    if (!applyRateLimit(createDemoLimiter, req, res, 'demo-create')) return;

    // An empty body (older clients) means the defaults.
    const parsed = CreateDemoBodySchema.safeParse(req.body === '' || req.body == null ? undefined : req.body);
    if (!parsed.success) return sendFail(res, 400, 'VALIDATION_ERROR', 'Invalid request body', parsed.error.issues);
    const { mode } = parsed.data;
    const locale = normalizeLocale(parsed.data.locale);

    let demo: Awaited<ReturnType<typeof createDemoWorkspace>>;
    try {
      demo = await createDemoWorkspace({ locale, mode });
    } catch (error) {
      console.error('Error creating demo workspace:', error);
      return sendFail(res, 500, 'DEMO_CREATE_ERROR', 'Error creating demo workspace');
    }

    return res.json({
      data: {
        workspaceId: demo.workspaceId,
        userId: demo.userId,
        expiresAt: demo.expiresAt.toISOString(),
        loginToken: createDemoLoginToken(demo.userId),
        mode,
      },
    });
  },
});
