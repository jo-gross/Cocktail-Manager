import { describe, expect, it, vi } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';
import { onPlanError, reportPlanError, reportPlanErrorResponse } from '@lib/entitlements/planEvents';
import { EXPORT_STATUS_EXEMPTION, HANDOFF_STATUS_EXEMPTION, statusExemptionsOf, withStatusExemption } from '@lib/entitlements/statusGate';
import { planDisplayName, usagePercent } from '@components/plan/planLabels';

describe('plan events', () => {
  it('reports only 402 responses with a plan error code', () => {
    const listener = vi.fn();
    const unsubscribe = onPlanError(listener);
    reportPlanError(400, 'PLAN_LIMIT_REACHED', { key: 'cocktails', limit: 1, current: 1 });
    reportPlanError(402, 'PAYMENT', null);
    reportPlanError(402, 'PLAN_LIMIT_REACHED', { key: 'cocktails', limit: 50, current: 50 });
    reportPlanError(402, 'WORKSPACE_READ_ONLY', { key: 'status', limit: null, current: null });
    reportPlanError(402, 'PLAN_FEATURE_MISSING', 'not an object', 'get');
    reportPlanError(402, 'WORKSPACE_SUSPENDED', null, 'DELETE');
    unsubscribe();
    reportPlanError(402, 'PLAN_LIMIT_REACHED', null);

    expect(listener.mock.calls.map(([event]) => event)).toEqual([
      // Without a method the request was a `GET` (fetch default).
      { code: 'PLAN_LIMIT_REACHED', details: { key: 'cocktails', limit: 50, current: 50 }, read: true },
      { code: 'WORKSPACE_READ_ONLY', details: { key: 'status', limit: null, current: null }, read: true },
      { code: 'PLAN_FEATURE_MISSING', details: null, read: true },
      { code: 'WORKSPACE_SUSPENDED', details: null, read: false },
    ]);
  });
});

describe('reportPlanErrorResponse', () => {
  it('reads code and issues from a raw v1 error body', () => {
    const listener = vi.fn();
    const unsubscribe = onPlanError(listener);
    reportPlanErrorResponse(402, { message: 'legacy', error: { code: 'PLAN_LIMIT_REACHED', issues: { key: 'cocktails', limit: 1, current: 1 } } });
    reportPlanErrorResponse(402, null);
    reportPlanErrorResponse(500, { error: { code: 'PLAN_LIMIT_REACHED' } });
    unsubscribe();
    // Raw `fetch` callers report writes.
    expect(listener.mock.calls.map(([event]) => event)).toEqual([
      { code: 'PLAN_LIMIT_REACHED', details: { key: 'cocktails', limit: 1, current: 1 }, read: false },
    ]);
  });
});

describe('withStatusExemption', () => {
  it('marks the request with the exemptions of its method before the handler runs', async () => {
    const seen: unknown[] = [];
    const handler = withStatusExemption({ DELETE: ['READ_ONLY', 'SUSPENDED'] }, (req: NextApiRequest) => {
      seen.push(statusExemptionsOf(req));
    });
    await handler({ method: 'DELETE' } as NextApiRequest, {} as NextApiResponse);
    await handler({ method: 'PUT' } as NextApiRequest, {} as NextApiResponse);
    expect(seen).toEqual([['READ_ONLY', 'SUSPENDED'], []]);
    expect(statusExemptionsOf({ method: 'GET' } as NextApiRequest)).toEqual([]);
  });

  it('keeps exports and the portal handoff available in every restricted status', () => {
    expect(EXPORT_STATUS_EXEMPTION).toEqual({ GET: ['READ_ONLY', 'SUSPENDED'], POST: ['READ_ONLY', 'SUSPENDED'] });
    expect(HANDOFF_STATUS_EXEMPTION).toEqual({ POST: ['READ_ONLY', 'SUSPENDED'] });
  });
});

describe('plan labels', () => {
  it('picks the plan name in the UI language', () => {
    const plan = { planName: { de: 'Bar Pro DE', en: 'Bar Pro EN' } };
    expect(planDisplayName(plan, 'de')).toBe('Bar Pro DE');
    expect(planDisplayName(plan, 'de-AT')).toBe('Bar Pro DE');
    expect(planDisplayName(plan, 'en')).toBe('Bar Pro EN');
    expect(planDisplayName(plan, undefined)).toBe('Bar Pro EN');
  });

  it('computes the usage share', () => {
    expect(usagePercent(5, null)).toBeNull();
    expect(usagePercent(1, 4)).toBe(25);
    expect(usagePercent(9, 4)).toBe(100);
    expect(usagePercent(0, 0)).toBe(100);
  });
});

describe('OpenAPI 402 registry', () => {
  it('only names documented operations, and documents the codes', async () => {
    const { flattenOperations } = await import('@lib/openapi/flattenOperations');
    const { PLAN_GUARDED_OPERATIONS, STATUS_EXEMPT_OPERATIONS, planErrorDescription } = await import('@lib/entitlements/openapi');
    const operations = new Set((await flattenOperations()).map((op) => `${op.method} ${op.basePath}`));
    for (const key of [...Object.keys(PLAN_GUARDED_OPERATIONS), ...Object.keys(STATUS_EXEMPT_OPERATIONS)]) expect(operations, key).toContain(key);

    expect(planErrorDescription('POST', '/workspaces/{workspaceId}/cocktails', {})).toContain('`PLAN_LIMIT_REACHED` (`cocktails`)');
    expect(planErrorDescription('POST', '/workspaces/{workspaceId}/cocktails', {})).toContain('`WORKSPACE_READ_ONLY`');
    expect(planErrorDescription('GET', '/workspaces/{workspaceId}/cocktails', {})).not.toContain('WORKSPACE_READ_ONLY');
    expect(planErrorDescription('POST', '/workspaces/{workspaceId}/leave', { sessionOnly: true })).toBeNull();
    expect(planErrorDescription('PUT', '/instance/entitlements/default', { auth: 'master' })).toBeNull();
  }, 60_000);
});
