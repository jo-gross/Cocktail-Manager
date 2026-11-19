import { afterEach, describe, expect, it, vi } from 'vitest';
import { INSTANCE_CAPABILITIES, entitlementsMode, instanceCapabilities, parseEntitlementsMode } from '@lib/instance/config';

describe('parseEntitlementsMode', () => {
  it('defaults to off when unset or empty', () => {
    expect(parseEntitlementsMode(undefined)).toEqual({ mode: 'off', valid: true });
    expect(parseEntitlementsMode('')).toEqual({ mode: 'off', valid: true });
    expect(parseEntitlementsMode('   ')).toEqual({ mode: 'off', valid: true });
  });

  it('accepts off and managed, case-insensitive and trimmed', () => {
    expect(parseEntitlementsMode('off')).toEqual({ mode: 'off', valid: true });
    expect(parseEntitlementsMode('managed')).toEqual({ mode: 'managed', valid: true });
    expect(parseEntitlementsMode(' Managed ')).toEqual({ mode: 'managed', valid: true });
  });

  it('treats invalid values as off and reports them', () => {
    for (const value of ['on', 'true', '1', 'managed-ish', 'offf']) {
      expect(parseEntitlementsMode(value)).toEqual({ mode: 'off', valid: false });
    }
  });
});

describe('entitlementsMode', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('reads ENTITLEMENTS_MODE', () => {
    vi.stubEnv('ENTITLEMENTS_MODE', 'managed');
    expect(entitlementsMode()).toBe('managed');
    vi.stubEnv('ENTITLEMENTS_MODE', '');
    expect(entitlementsMode()).toBe('off');
  });

  it('falls back to off for an invalid value and warns without echoing it', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubEnv('ENTITLEMENTS_MODE', 'secret-looking-value');
    expect(entitlementsMode()).toBe('off');
    expect(warn.mock.calls.flat().join(' ')).not.toContain('secret-looking-value');
  });
});

describe('instance capabilities', () => {
  it('serves only instance.read in every mode', () => {
    expect(INSTANCE_CAPABILITIES).toEqual(['instance.read']);
    expect(instanceCapabilities('off')).toEqual(['instance.read']);
  });

  it('advertises announcements and support.write only when managed', () => {
    expect(instanceCapabilities('managed')).toEqual(['instance.read', 'entitlements', 'announcements', 'support.write']);
  });
});
