import { describe, expect, it } from 'vitest';
import {
  LIMIT_KEYS,
  SnapshotWireSchema,
  decideLimit,
  decideStatus,
  effectiveSnapshot,
  hasFeature,
  isFreeWorkspace,
  limitOf,
  parseFreeWorkspacesPerOwner,
  shouldApply,
} from '@lib/entitlements/snapshot';
import { instanceCapabilities } from '@lib/instance/config';
import { snapshotWire as snapshot } from '@test/helpers/entitlements';
import { PLAN_FEATURE_MISSING, PLAN_LIMIT_REACHED, planFeatureMissing, planLimitReached, workspaceStatusBlocked } from '@lib/entitlements/errors';

describe('SnapshotWireSchema', () => {
  it('accepts the wire format of the control plane', () => {
    expect(SnapshotWireSchema.safeParse(snapshot({ features: ['signage', 'templates:menu'], nextChangeAt: '2026-12-01T00:00:00.000Z' })).success).toBe(true);
  });

  it('strips unknown top-level fields and unknown limit keys (forward compatible) and keeps the hash', () => {
    const base = snapshot();
    const parsed = SnapshotWireSchema.parse({
      ...base,
      extra: true,
      limits: { ...base.limits, freeWorkspacesPerOwner: 1 },
      planName: { ...base.planName, fr: 'x' },
    });
    expect(parsed).toEqual(base);
    expect(parsed.hash).toBe(base.hash);
  });

  it('accepts scheduledEnd set, null or missing and strips unknown fields inside it', () => {
    const scheduledEnd = { at: '2026-12-31T23:59:59.000Z', planKey: 'homebar_free', planName: { de: 'Homebar Free', en: 'Homebar Free' } };
    const base = snapshot({ planKey: 'bar_pro' });
    expect(SnapshotWireSchema.parse({ ...base, scheduledEnd }).scheduledEnd).toEqual(scheduledEnd);
    expect(SnapshotWireSchema.parse({ ...base, scheduledEnd: { ...scheduledEnd, at: '2026-12-31T23:59:59+01:00', reason: 'x' } }).scheduledEnd).toEqual({
      ...scheduledEnd,
      at: '2026-12-31T23:59:59+01:00',
    });
    expect(SnapshotWireSchema.parse({ ...base, scheduledEnd: null }).scheduledEnd).toBeNull();
    expect(SnapshotWireSchema.parse(base)).not.toHaveProperty('scheduledEnd');
  });

  it('refuses a wrongly typed scheduledEnd', () => {
    const scheduledEnd = { at: '2026-12-31T23:59:59.000Z', planKey: 'homebar_free', planName: { de: 'Homebar Free', en: 'Homebar Free' } };
    const { planKey: _planKey, ...withoutPlanKey } = scheduledEnd;
    const invalid: unknown[] = [
      '2026-12-31T23:59:59.000Z',
      true,
      [],
      {},
      withoutPlanKey,
      { ...scheduledEnd, at: '2026-12-31' },
      { ...scheduledEnd, at: null },
      { ...scheduledEnd, at: 1798761599 },
      { ...scheduledEnd, planKey: '' },
      { ...scheduledEnd, planKey: 7 },
      { ...scheduledEnd, planName: 'Homebar Free' },
      { ...scheduledEnd, planName: { de: 'Homebar Free' } },
    ];
    for (const value of invalid) expect(SnapshotWireSchema.safeParse({ ...snapshot(), scheduledEnd: value }).success, JSON.stringify(value)).toBe(false);
  });

  it('refuses missing and wrongly typed known fields', () => {
    const base = snapshot();
    const { billing: _billing, ...withoutBilling } = base;
    const invalid: unknown[] = [
      withoutBilling,
      { ...base, limits: { cocktails: 1 } },
      { ...base, version: 0 },
      { ...base, version: 1.5 },
      { ...base, hash: 'A'.repeat(64) },
      { ...base, hash: 'abc' },
      { ...base, status: 'PAUSED' },
      { ...base, billing: 'stripe' },
      { ...base, limits: { ...base.limits, members: -1 } },
      { ...base, limits: { ...base.limits, members: '3' } },
      { ...base, planName: { de: 'x' } },
      { ...base, nextChangeAt: 'tomorrow' },
      { ...base, planKey: '' },
      { ...base, features: 'signage' },
    ];
    for (const value of invalid) expect(SnapshotWireSchema.safeParse(value).success).toBe(false);
  });
});

describe('effectiveSnapshot', () => {
  const own = snapshot({ planKey: 'bar_pro' });
  const fallback = snapshot();

  it('checks nothing with ENTITLEMENTS_MODE=off, even with pushed snapshots', () => {
    expect(effectiveSnapshot('off', own, fallback)).toBeNull();
  });

  it('prefers the workspace snapshot, then the instance default', () => {
    expect(effectiveSnapshot('managed', own, fallback)).toEqual({ snapshot: own, source: 'workspace' });
    expect(effectiveSnapshot('managed', null, fallback)).toEqual({ snapshot: fallback, source: 'default' });
  });

  it('allows everything in managed mode until the first push', () => {
    const effective = effectiveSnapshot('managed', null, null);
    expect(effective).toBeNull();
    expect(hasFeature(effective, 'signage')).toBe(true);
    for (const key of LIMIT_KEYS) expect(limitOf(effective, key)).toBeNull();
  });

  it('reads features and limits of the effective snapshot', () => {
    const effective = effectiveSnapshot('managed', snapshot({ features: ['api'], limits: { ...fallback.limits, apiKeys: null } }), null);
    expect(hasFeature(effective, 'api')).toBe(true);
    expect(hasFeature(effective, 'signage')).toBe(false);
    expect(limitOf(effective, 'apiKeys')).toBeNull();
    expect(limitOf(effective, 'cocktails')).toBe(50);
  });
});

describe('shouldApply (version rule)', () => {
  it('applies only a higher version', () => {
    expect(shouldApply(null, 1)).toBe(true);
    expect(shouldApply(3, 4)).toBe(true);
    expect(shouldApply(3, 3)).toBe(false);
    expect(shouldApply(3, 2)).toBe(false);
  });
});

describe('decideLimit', () => {
  it('allows up to the limit and refuses above it', () => {
    expect(decideLimit(3, 2, 3)).toEqual({ allowed: true });
    expect(decideLimit(3, 3, 4)).toEqual({ allowed: false, limit: 3, current: 3 });
    expect(decideLimit(0, 0, 1)).toEqual({ allowed: false, limit: 0, current: 0 });
  });

  it('never limits unlimited keys', () => {
    expect(decideLimit(null, 10_000, 10_001)).toEqual({ allowed: true });
  });

  it('keeps writes allowed that do not raise the count, also over the limit (downgrade)', () => {
    expect(decideLimit(2, 5, 5)).toEqual({ allowed: true });
    expect(decideLimit(2, 5, 4)).toEqual({ allowed: true });
    expect(decideLimit(2, 5, 6)).toEqual({ allowed: false, limit: 2, current: 5 });
  });

  it('refuses an import that would end above the limit', () => {
    expect(decideLimit(50, 40, 60)).toEqual({ allowed: false, limit: 50, current: 40 });
    expect(decideLimit(50, 40, 50)).toEqual({ allowed: true });
  });
});

describe('decideStatus', () => {
  it('allows everything for ACTIVE and GRACE', () => {
    for (const status of ['ACTIVE', 'GRACE'] as const) {
      for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) expect(decideStatus(status, method)).toEqual({ allowed: true });
    }
  });

  it('READ_ONLY allows only reads unless the route is exempt', () => {
    expect(decideStatus('READ_ONLY', 'GET')).toEqual({ allowed: true });
    expect(decideStatus('READ_ONLY', 'head')).toEqual({ allowed: true });
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      expect(decideStatus('READ_ONLY', method)).toEqual({ allowed: false, code: 'WORKSPACE_READ_ONLY' });
    }
    expect(decideStatus('READ_ONLY', 'POST', ['READ_ONLY'])).toEqual({ allowed: true });
    expect(decideStatus('READ_ONLY', 'POST', ['SUSPENDED'])).toEqual({ allowed: false, code: 'WORKSPACE_READ_ONLY' });
  });

  it('SUSPENDED blocks reads and writes unless the route is exempt for SUSPENDED', () => {
    expect(decideStatus('SUSPENDED', 'GET')).toEqual({ allowed: false, code: 'WORKSPACE_SUSPENDED' });
    expect(decideStatus('SUSPENDED', 'POST', ['READ_ONLY'])).toEqual({ allowed: false, code: 'WORKSPACE_SUSPENDED' });
    expect(decideStatus('SUSPENDED', 'GET', ['SUSPENDED'])).toEqual({ allowed: true });
  });
});

describe('freeWorkspacesPerOwner', () => {
  it('parses a non-negative integer, otherwise unlimited', () => {
    expect(parseFreeWorkspacesPerOwner('2')).toBe(2);
    expect(parseFreeWorkspacesPerOwner(' 0 ')).toBe(0);
    for (const value of [undefined, '', '-1', '1.5', 'two', '9999999999']) expect(parseFreeWorkspacesPerOwner(value)).toBeNull();
  });

  it('counts workspaces on the default plan as free', () => {
    expect(isFreeWorkspace(null, 'homebar_free')).toBe(true);
    expect(isFreeWorkspace('homebar_free', 'homebar_free')).toBe(true);
    expect(isFreeWorkspace('bar_pro', 'homebar_free')).toBe(false);
  });
});

describe('capabilities', () => {
  it('advertises entitlements only in managed mode', () => {
    expect(instanceCapabilities('off')).not.toContain('entitlements');
    expect(instanceCapabilities('managed')).toContain('entitlements');
  });
});

describe('plan errors', () => {
  it('are 402 with { key, limit, current }', () => {
    const limit = planLimitReached('cocktails', 50, 50);
    expect(limit).toMatchObject({ status: 402, code: PLAN_LIMIT_REACHED, issues: { key: 'cocktails', limit: 50, current: 50 } });
    expect(planFeatureMissing('api')).toMatchObject({ status: 402, code: PLAN_FEATURE_MISSING, issues: { key: 'api', limit: null, current: null } });
    expect(workspaceStatusBlocked({ allowed: false, code: 'WORKSPACE_SUSPENDED' })).toMatchObject({ status: 402, code: 'WORKSPACE_SUSPENDED' });
  });
});
