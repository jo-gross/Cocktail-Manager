import { NextApiRequest, NextApiResponse } from 'next';
import { constants as HttpStatus } from 'http2';

/**
 * Adds CORS support to the v1 REST API so it can be called from a browser on a
 * different origin — most importantly the OpenAPI "Try it out" console in the
 * docs site (Docusaurus), which runs on a separate host from the API.
 *
 * The v1 API authenticates every request with a Bearer API key (see
 * jwtApiKeyMiddleware), never with cookies, so the default policy is a wildcard
 * origin: a cross-origin page still needs a valid key to do anything, and a
 * wildcard never exposes credentialed (cookie-bearing) responses. To lock the
 * API down to specific origins, set API_CORS_ALLOWED_ORIGINS to a
 * comma-separated allowlist (e.g. "https://staging.cocktail-manager.app").
 */

// Request headers the docs console sends that are NOT CORS-safelisted and must
// therefore be echoed back on the preflight: the API key and JSON bodies.
const ALLOWED_HEADERS = 'Authorization, Content-Type';

// Cache the preflight result for a day to avoid an OPTIONS round-trip per call.
const MAX_AGE_SECONDS = '86400';

/**
 * Resolves the value for `Access-Control-Allow-Origin`, or `null` when the
 * request's origin is not permitted (in which case no CORS headers are sent and
 * the browser blocks the response).
 */
function resolveAllowOrigin(req: NextApiRequest): string | null {
  const configured = process.env.API_CORS_ALLOWED_ORIGINS?.trim();
  if (!configured) {
    return '*';
  }

  const allowlist = configured
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (allowlist.includes('*')) {
    return '*';
  }

  const origin = req.headers.origin;
  if (origin && allowlist.includes(origin)) {
    return origin;
  }

  return null;
}

export function withCors(handler: (req: NextApiRequest, res: NextApiResponse) => Promise<unknown> | unknown, allowedMethods: string[]) {
  const allowMethods = [...new Set([...allowedMethods, 'OPTIONS'])].join(', ');

  return async (req: NextApiRequest, res: NextApiResponse) => {
    const allowOrigin = resolveAllowOrigin(req);
    if (allowOrigin) {
      res.setHeader('Access-Control-Allow-Origin', allowOrigin);
      if (allowOrigin !== '*') {
        // Response depends on the request Origin, so caches must key on it.
        res.setHeader('Vary', 'Origin');
      }
      res.setHeader('Access-Control-Allow-Methods', allowMethods);
      res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS);
      res.setHeader('Access-Control-Max-Age', MAX_AGE_SECONDS);
    }

    // Answer the preflight before auth/validation run. withHttpMethods has no
    // OPTIONS handler and would otherwise reject it with 405, failing the check.
    if (req.method === 'OPTIONS') {
      return res.status(HttpStatus.HTTP_STATUS_NO_CONTENT).end();
    }

    return handler(req, res);
  };
}
