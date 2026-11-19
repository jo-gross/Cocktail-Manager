import { describe, expect, it } from 'vitest';
import { decodeWorkspaceCursor, encodeWorkspaceCursor } from '@lib/instance/cursor';
import { InstanceUserSearchQuerySchema, InstanceWorkspaceListQuerySchema } from '@lib/schemas/instance';

describe('workspace cursor', () => {
  it('round-trips a workspace id', () => {
    const cursor = encodeWorkspaceCursor('cmabc123');
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeWorkspaceCursor(cursor)).toBe('cmabc123');
  });

  it('rejects malformed cursors', () => {
    const wrongVersion = Buffer.from(JSON.stringify({ v: 2, id: 'x' })).toString('base64url');
    const noId = Buffer.from(JSON.stringify({ v: 1 })).toString('base64url');
    const longId = Buffer.from(JSON.stringify({ v: 1, id: 'x'.repeat(129) })).toString('base64url');
    for (const cursor of ['', '50', 'not base64!', 'eyJ2IjoxfQ==', wrongVersion, noId, longId, Buffer.from('[]').toString('base64url')]) {
      expect(decodeWorkspaceCursor(cursor), cursor).toBeNull();
    }
  });
});

describe('InstanceWorkspaceListQuerySchema', () => {
  const parse = (query: Record<string, unknown>) => InstanceWorkspaceListQuerySchema.safeParse(query);

  it('defaults limit to 50 and leaves the filters unset', () => {
    expect(parse({})).toMatchObject({ success: true, data: { limit: 50 } });
  });

  it('coerces limit from the query string and bounds it to 1..200', () => {
    expect(parse({ limit: '1' })).toMatchObject({ success: true, data: { limit: 1 } });
    expect(parse({ limit: '200' })).toMatchObject({ success: true, data: { limit: 200 } });
    for (const limit of ['0', '201', '-1', '2.5', 'abc', ['10', '20']]) {
      expect(parse({ limit }).success, JSON.stringify(limit)).toBe(false);
    }
  });

  it('accepts only cursors issued by the server', () => {
    expect(parse({ cursor: encodeWorkspaceCursor('ws-1') }).success).toBe(true);
    expect(parse({ cursor: '50' }).success).toBe(false);
    expect(parse({ cursor: 'x'.repeat(401) }).success).toBe(false);
  });

  it('accepts ISO 8601 timestamps with Z or an offset for updatedSince', () => {
    expect(parse({ updatedSince: '2026-11-19T10:00:00.000Z' }).success).toBe(true);
    expect(parse({ updatedSince: '2026-11-19T11:00:00+01:00' }).success).toBe(true);
    for (const updatedSince of ['2026-11-19', 'yesterday', '1700000000000']) {
      expect(parse({ updatedSince }).success, updatedSince).toBe(false);
    }
  });

  it('trims and bounds q', () => {
    expect(parse({ q: '  bar ' })).toMatchObject({ success: true, data: { q: 'bar' } });
    expect(parse({ q: 'x'.repeat(201) }).success).toBe(false);
  });
});

describe('InstanceUserSearchQuerySchema', () => {
  it('makes q optional and bounds it', () => {
    expect(InstanceUserSearchQuerySchema.safeParse({}).success).toBe(true);
    expect(InstanceUserSearchQuerySchema.safeParse({ q: 'anna' })).toMatchObject({ success: true, data: { q: 'anna' } });
    expect(InstanceUserSearchQuerySchema.safeParse({ q: 'x'.repeat(201) }).success).toBe(false);
  });
});
