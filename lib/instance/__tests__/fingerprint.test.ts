import { describe, expect, it } from 'vitest';
import { canonicalJson, requestFingerprint } from '@lib/instance/fingerprint';

describe('canonicalJson', () => {
  it('sorts object keys at every depth and keeps array order', () => {
    expect(canonicalJson({ b: 1, a: { d: [2, 1], c: null } })).toBe('{"a":{"c":null,"d":[2,1]},"b":1}');
    expect(canonicalJson({ a: 1, b: 2 })).toBe(canonicalJson({ b: 2, a: 1 }));
  });

  it('drops undefined properties and writes undefined as null', () => {
    expect(canonicalJson({ a: undefined, b: 'x' })).toBe('{"b":"x"}');
    expect(canonicalJson(undefined)).toBe('null');
  });
});

describe('requestFingerprint', () => {
  const target = { type: 'workspace', id: 'w1' };

  it('is equal for equal requests, whatever the key order', () => {
    expect(requestFingerprint('a', target, { x: 1, y: 2 })).toBe(requestFingerprint('a', { id: 'w1', type: 'workspace' }, { y: 2, x: 1 }));
    expect(requestFingerprint('a', target, undefined)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('differs by action, target and payload', () => {
    const base = requestFingerprint('a', target, { x: 1 });
    expect(requestFingerprint('b', target, { x: 1 })).not.toBe(base);
    expect(requestFingerprint('a', { type: 'workspace', id: 'w2' }, { x: 1 })).not.toBe(base);
    expect(requestFingerprint('a', target, { x: 2 })).not.toBe(base);
  });
});
