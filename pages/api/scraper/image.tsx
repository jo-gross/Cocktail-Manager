import { withHttpMethods } from '@middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';
import { withAuthentication } from '@middleware/api/authenticationMiddleware';
import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { User } from '@generated/prisma/client';
import { REMOTE_IMAGE_CONTENT_TYPES, safeFetch, SafeFetchError } from '@lib/http/safeFetch';
import { TokenBucketRateLimiter } from '@lib/http/rateLimit';
import { sendFail } from '@lib/http/responses';
import { sendImage } from '@lib/images/imageResponse';

const QuerySchema = z.object({ url: z.string().trim().min(1).max(2048) });

const MAX_IMAGE_BYTES = 5_000_000;

/** Per user: every call is an outbound request. */
const imageProxyLimiter = new TokenBucketRateLimiter({ capacity: 20, refillPerSecond: 20 / 60 });

/**
 * Loads a remote image for "import photo by URL" (the browser cannot fetch
 * cross-origin images itself). Public hosts only (SSRF guard), raster images up
 * to 5 MB, served with nosniff + sandbox CSP so nothing can run on our origin.
 */
export default withHttpMethods({
  [HTTPMethod.GET]: withAuthentication(async (req: NextApiRequest, res: NextApiResponse, user: User) => {
    const limit = imageProxyLimiter.take(`scraper-image:${user.id}`);
    if (!limit.allowed) {
      res.setHeader('Retry-After', String(limit.retryAfterSeconds));
      return sendFail(res, 429, 'RATE_LIMITED', 'Too many requests');
    }

    const parsed = QuerySchema.safeParse(req.query);
    if (!parsed.success) return sendFail(res, 400, 'VALIDATION_ERROR', 'URL is required', parsed.error.issues);

    try {
      const image = await safeFetch(parsed.data.url, { accept: REMOTE_IMAGE_CONTENT_TYPES, maxBytes: MAX_IMAGE_BYTES });
      if (image.body.length === 0) return sendFail(res, 400, 'NOT_AN_IMAGE', 'URL is not an image');
      return sendImage(res, { contentType: image.contentType, bytes: image.body }, 'private, no-store');
    } catch (error) {
      if (!(error instanceof SafeFetchError)) throw error;
      if (error.reason === 'BAD_CONTENT_TYPE') return sendFail(res, 400, 'NOT_AN_IMAGE', 'URL is not an image');
      if (error.reason === 'TOO_LARGE') return sendFail(res, 400, 'IMAGE_TOO_LARGE', 'Image is too large');
      return sendFail(res, 400, 'FETCH_FAILED', 'Failed to fetch image');
    }
  }),
});
