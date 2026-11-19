/**
 * Route exemptions of the status gate. `withWorkspacePermission` and `withWorkspaceSession` refuse requests to a
 * `READ_ONLY` or `SUSPENDED` workspace centrally (see `decideStatus`); a route that must stay usable wraps its handler
 * with `withStatusExemption`, which marks the request before authentication runs. Pure module.
 *
 * Exempt routes (docs/ENTITLEMENTS.md "Status"):
 * - exports (backup, JSON, PDF): `READ_ONLY` and `SUSPENDED`
 * - leaving the workspace, deleting the workspace: `READ_ONLY` and `SUSPENDED`
 * - status view (`GET` workspace, `GET` entitlement): `SUSPENDED` (reads are open in `READ_ONLY` anyway)
 * - portal handoff (task A3): `READ_ONLY` and `SUSPENDED` (paying must stay possible); wrap the handoff handler with `HANDOFF_STATUS_EXEMPTION`
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import type { HttpVerb } from '@lib/openapi/types';
import type { RestrictedStatus } from './snapshot';

const STATUS_EXEMPTION = Symbol.for('cocktail-manager.entitlements.statusExemption');

export type StatusExemptions = Partial<Record<HttpVerb, readonly RestrictedStatus[]>>;

type RequestHandler = (req: NextApiRequest, res: NextApiResponse) => unknown;

/** Every restricted status: exports, leaving and deleting. */
export const ALWAYS_AVAILABLE: readonly RestrictedStatus[] = ['READ_ONLY', 'SUSPENDED'];
/** The status view a suspended workspace still shows. */
export const STATUS_VIEW: readonly RestrictedStatus[] = ['SUSPENDED'];
/** Data exports (backup, JSON, PDF, print HTML) stay available in every status. */
export const EXPORT_STATUS_EXEMPTION: StatusExemptions = { GET: ALWAYS_AVAILABLE, POST: ALWAYS_AVAILABLE };
/** Integration point for the portal handoff (A3): paying must stay possible in a read-only or suspended workspace. */
export const HANDOFF_STATUS_EXEMPTION: StatusExemptions = { POST: ['READ_ONLY', 'SUSPENDED'] };

export function withStatusExemption<H extends RequestHandler>(exemptions: StatusExemptions, handler: H): H {
  const wrapped = (req: NextApiRequest, res: NextApiResponse) => {
    const method = (req.method ?? 'GET').toUpperCase() as HttpVerb;
    (req as unknown as Record<symbol, readonly RestrictedStatus[]>)[STATUS_EXEMPTION] = exemptions[method] ?? [];
    return handler(req, res);
  };
  return wrapped as H;
}

export function statusExemptionsOf(req: NextApiRequest): readonly RestrictedStatus[] {
  return (req as unknown as Record<symbol, readonly RestrictedStatus[] | undefined>)[STATUS_EXEMPTION] ?? [];
}
