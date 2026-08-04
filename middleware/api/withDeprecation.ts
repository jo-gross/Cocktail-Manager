/**
 * Wraps a legacy (unversioned) route handler to advertise deprecation without
 * changing its behavior. Adds RFC 8594 `Sunset` (optional), a `Deprecation`
 * header and an RFC 8288 `Link` pointing at the successor v1 path.
 */
import type { NextApiRequest, NextApiResponse } from 'next';

export interface DeprecationOptions {
  /** Successor URL, e.g. '/api/v1/workspaces/{workspaceId}/glasses'. */
  successor: string;
  /** Optional Sunset date (HTTP-date). Omit until a sunset is scheduled. */
  sunset?: string;
}

export function withDeprecation(opts: DeprecationOptions, handler: (req: NextApiRequest, res: NextApiResponse) => unknown | Promise<unknown>) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    res.setHeader('Deprecation', 'true');
    if (opts.sunset) res.setHeader('Sunset', opts.sunset);
    res.setHeader('Link', `<${opts.successor}>; rel="successor-version"`);
    return handler(req, res);
  };
}
