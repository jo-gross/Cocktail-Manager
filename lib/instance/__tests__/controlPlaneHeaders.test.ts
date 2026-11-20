import { describe, expect, it } from 'vitest';
import { MAX_ACTOR_LENGTH, MAX_REASON_LENGTH, parseControlPlaneHeaders } from '@lib/instance/controlPlaneHeaders';

describe('parseControlPlaneHeaders', () => {
  it('returns nulls without headers', () => {
    expect(parseControlPlaneHeaders({})).toEqual({ ok: true, value: { actor: null, reason: null, idempotencyKey: null } });
  });

  it('trims values, replaces control characters and lower-cases the idempotency key', () => {
    const result = parseControlPlaneHeaders({
      'x-cm-actor': ' admin@example.test ',
      'x-cm-reason': 'line1\nline2',
      'idempotency-key': 'A1B2C3D4-0000-4000-8000-000000000001',
    });
    expect(result).toEqual({
      ok: true,
      value: { actor: 'admin@example.test', reason: 'line1 line2', idempotencyKey: 'a1b2c3d4-0000-4000-8000-000000000001' },
    });
  });

  it('reports too long values and malformed idempotency keys instead of cutting them', () => {
    const result = parseControlPlaneHeaders({
      'x-cm-actor': 'a'.repeat(MAX_ACTOR_LENGTH + 1),
      'x-cm-reason': 'r'.repeat(MAX_REASON_LENGTH + 1),
      'idempotency-key': 'not-a-uuid',
    });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.issues.map((issue) => issue.header)).toEqual(['X-CM-Actor', 'X-CM-Reason', 'Idempotency-Key']);
  });

  it('uses the first value of repeated headers', () => {
    const result = parseControlPlaneHeaders({ 'x-cm-actor': ['first@test', 'second@test'] as unknown as string });
    expect(result).toMatchObject({ ok: true, value: { actor: 'first@test' } });
  });
});
