/**
 * The 402 responses of the entitlement guards in the OpenAPI document (docs/ENTITLEMENTS.md). Pure module, read by
 * `lib/openapi/buildDocument.ts`; a unit test keeps every key pointing at a documented operation.
 *
 * - Every workspace operation passes the status gate: `WORKSPACE_SUSPENDED` (all methods) and `WORKSPACE_READ_ONLY`
 *   (writes), unless the route is exempt (`STATUS_EXEMPT_OPERATIONS`), plus `PLAN_FEATURE_MISSING` (`api`) for
 *   workspace API keys.
 * - `PLAN_GUARDED_OPERATIONS` adds the limits and features a write path checks.
 */
import type { HttpVerb, RouteSpec } from '@lib/openapi/types';
import type { FeatureKey, LimitKey, RestrictedStatus } from './snapshot';

type OperationKey = `${HttpVerb} ${string}`;

const W = '/workspaces/{workspaceId}';
const SIGNAGE_WRITE = { features: ['signage'] } as const;
const ADVANCED = { features: ['statistics.advanced'] } as const;

export const PLAN_GUARDED_OPERATIONS: Partial<Record<OperationKey, { limits?: readonly LimitKey[]; features?: readonly FeatureKey[] }>> = {
  [`POST ${W}/cocktails`]: { limits: ['cocktails'] },
  [`POST ${W}/cocktails/{cocktailId}/clone`]: { limits: ['cocktails'] },
  [`PUT ${W}/cocktails/{cocktailId}/unarchive`]: { limits: ['cocktails'] },
  [`POST ${W}/cocktails/import/json`]: { limits: ['cocktails'] },
  [`POST ${W}/templates/{key}/apply`]: { limits: ['cocktails', 'calculations', 'guestMenusPublished', 'signageScreens'] },
  [`POST ${W}/join-requests/{userId}/accept`]: { limits: ['members'] },
  [`POST ${W}/calculations`]: { limits: ['calculations'] },
  [`POST ${W}/calculations/import/json`]: { limits: ['calculations'] },
  [`POST ${W}/guest-menus/{menuId}/publish`]: { limits: ['guestMenusPublished'] },
  [`PUT ${W}/admin/signage`]: { ...SIGNAGE_WRITE, limits: ['signageScreens'] },
  [`POST ${W}/admin/signage/key`]: SIGNAGE_WRITE,
  [`POST ${W}/admin/signage/slides`]: { ...SIGNAGE_WRITE, limits: ['signageScreens'] },
  [`PATCH ${W}/admin/signage/slides`]: SIGNAGE_WRITE,
  [`DELETE ${W}/admin/signage/slides/{slideId}`]: SIGNAGE_WRITE,
  [`POST ${W}/admin/signage/slides/guest-menu`]: { ...SIGNAGE_WRITE, limits: ['signageScreens'] },
  [`PATCH ${W}/admin/signage/slides/{slideId}/guest-menu`]: SIGNAGE_WRITE,
  [`POST ${W}/api-keys`]: { features: ['api'], limits: ['apiKeys'] },
  [`GET ${W}/statistics/advanced/overview`]: ADVANCED,
  [`GET ${W}/statistics/advanced/cocktails`]: ADVANCED,
  [`GET ${W}/statistics/advanced/cocktails/all`]: ADVANCED,
  [`GET ${W}/statistics/advanced/cocktails/{cocktailId}`]: ADVANCED,
  [`GET ${W}/statistics/advanced/cocktails/{cocktailId}/orders`]: ADVANCED,
  [`GET ${W}/statistics/advanced/ingredients`]: ADVANCED,
  [`GET ${W}/statistics/advanced/tags`]: ADVANCED,
  [`GET ${W}/statistics/advanced/compare`]: ADVANCED,
  [`GET ${W}/statistics/advanced/sets`]: ADVANCED,
  [`POST ${W}/statistics/advanced/sets`]: ADVANCED,
  [`PUT ${W}/statistics/advanced/sets`]: ADVANCED,
  [`DELETE ${W}/statistics/advanced/sets`]: ADVANCED,
  [`GET ${W}/statistics/advanced/sets/{setId}`]: ADVANCED,
};

const BOTH: readonly RestrictedStatus[] = ['READ_ONLY', 'SUSPENDED'];

/** Mirrors the `withStatusExemption` wrappers of the handlers. */
export const STATUS_EXEMPT_OPERATIONS: Partial<Record<OperationKey, readonly RestrictedStatus[]>> = {
  [`GET ${W}`]: ['SUSPENDED'],
  [`DELETE ${W}`]: BOTH,
  [`POST ${W}/leave`]: BOTH,
  [`GET ${W}/entitlement`]: ['SUSPENDED'],
  [`POST ${W}/cocktails/export/json`]: BOTH,
  [`POST ${W}/cocktails/export/pdf`]: BOTH,
  [`POST ${W}/calculations/export/json`]: BOTH,
  [`POST ${W}/glasses/export/json`]: BOTH,
  [`POST ${W}/garnishes/export/json`]: BOTH,
  [`POST ${W}/ingredients/export/json`]: BOTH,
  [`POST ${W}/guest-menus/{menuId}/export/pdf`]: BOTH,
  [`GET ${W}/guest-menus/{menuId}/export/html`]: BOTH,
  [`GET ${W}/guest-menus/{menuId}/export/table-tent.pdf`]: BOTH,
};

const list = (values: string[]) => values.map((value) => `\`${value}\``).join(', ');

/** Description of the 402 response of a workspace operation, `null` for operations without workspace auth. */
export function planErrorDescription(method: HttpVerb, basePath: string, spec: Pick<RouteSpec, 'auth' | 'sessionOnly'>): string | null {
  if (spec.auth === 'master' || spec.auth === 'user') return null;
  const key: OperationKey = `${method} ${basePath}`;
  const parts: string[] = [];
  const guard = PLAN_GUARDED_OPERATIONS[key];
  if (guard?.limits?.length) parts.push(`\`PLAN_LIMIT_REACHED\` (${list([...guard.limits])})`);
  if (guard?.features?.length) parts.push(`\`PLAN_FEATURE_MISSING\` (${list([...guard.features])})`);
  if (!spec.sessionOnly) parts.push('`PLAN_FEATURE_MISSING` (`api`) for workspace API keys');
  const exempt = STATUS_EXEMPT_OPERATIONS[key] ?? [];
  if (method !== 'GET' && !exempt.includes('READ_ONLY')) parts.push('`WORKSPACE_READ_ONLY`');
  if (!exempt.includes('SUSPENDED')) parts.push('`WORKSPACE_SUSPENDED`');
  if (parts.length === 0) return null;
  return `Hosted instances only (\`ENTITLEMENTS_MODE=managed\`): ${parts.join(', ')}. \`error.issues\` holds \`{ key, limit, current }\`.`;
}
