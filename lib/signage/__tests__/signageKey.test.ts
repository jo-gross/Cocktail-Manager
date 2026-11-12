/** Monitor key helpers + key-gated access tokens of the public `/api/signage/{id}` route. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';
import { buildSignagePath, generateSignageKey, isValidSignageKey } from '../signageKey';

const state = vi.hoisted(() => ({ signageKey: null as string | null, workspaceLookups: 0 }));

vi.mock('../../../prisma/prisma', () => ({
  default: {
    signage: {
      findMany: vi.fn(async () => [
        {
          workspaceId: 'ws1',
          format: 'LANDSCAPE',
          backgroundColor: null,
          backgroundMode: 'COLOR',
          slideDurationSeconds: 10,
          mirrorSourceFormat: null,
          slides: [
            {
              id: 's1',
              content: 'data:image/png;base64,AA',
              type: 'IMAGE',
              order: 0,
              enabled: true,
              weekdays: [],
              validFrom: null,
              validTo: null,
              dateExclusive: false,
            },
            {
              id: 's2',
              content: '',
              type: 'GUEST_MENU',
              guestMenuId: 'menu1',
              guestMenu: { slug: 'abend' },
              options: null,
              order: 1,
              enabled: true,
              weekdays: [],
              validFrom: null,
              validTo: null,
              dateExclusive: false,
            },
          ],
        },
      ]),
    },
    guestMenu: { findMany: vi.fn(async () => [{ id: 'menu1', accessCodeHash: 'n:hash', accessCodeVersion: 2 }]) },
    workspace: {
      findUnique: vi.fn(async () => {
        state.workspaceLookups++;
        return { signageKey: state.signageKey };
      }),
    },
  },
}));

process.env.BETTER_AUTH_SECRET ??= 'test-secret';
const { default: handler } = await import('../../../pages/api/signage/[id]');
const { verifyAccessToken } = await import('@lib/guest-menu/access');

interface SlideResult {
  id: string;
  guestMenuAccessTokens?: string[];
}

async function requestSignage(query: Record<string, string>) {
  const headers: Record<string, string> = {};
  let status = 200;
  let body: { content: { slides: SlideResult[] }[]; error?: { code: string } } | undefined;
  const res = {
    setHeader: (name: string, value: string) => {
      headers[name.toLowerCase()] = value;
      return res;
    },
    status: (code: number) => {
      status = code;
      return res;
    },
    json: (value: typeof body) => {
      body = value;
      return res;
    },
  } as unknown as NextApiResponse;
  await handler({ method: 'GET', query: { id: 'ws1', ...query }, headers: {} } as unknown as NextApiRequest, res);
  return { status, headers, body };
}

async function callSignage(query: Record<string, string>) {
  const { headers, body } = await requestSignage(query);
  const slides = body!.content[0].slides;
  return { headers, menuSlide: slides.find((slide) => slide.id === 's2')!, imageSlide: slides.find((slide) => slide.id === 's1')! };
}

describe('signage key helpers', () => {
  it('generates 32-byte base64url keys', () => {
    const key = generateSignageKey();
    expect(key).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateSignageKey()).not.toBe(key);
  });

  it('compares keys exactly', () => {
    const key = generateSignageKey();
    expect(isValidSignageKey(key, key)).toBe(true);
    expect(isValidSignageKey(key.slice(0, -1), key)).toBe(false);
    expect(isValidSignageKey(`${key}x`, key)).toBe(false);
    expect(isValidSignageKey('', key)).toBe(false);
    expect(isValidSignageKey(undefined, key)).toBe(false);
    expect(isValidSignageKey(['a'], key)).toBe(false);
    expect(isValidSignageKey(key, null)).toBe(false);
    expect(isValidSignageKey('x'.repeat(500), 'x'.repeat(500))).toBe(false);
  });

  it('builds the monitor path', () => {
    expect(buildSignagePath('ws1', null)).toBe('/signage?id=ws1');
    expect(buildSignagePath('ws1', 'a-b_c')).toBe('/signage?id=ws1&key=a-b_c');
  });
});

describe('/api/signage/{id} access tokens', () => {
  beforeEach(() => {
    state.signageKey = 'secret-key';
    state.workspaceLookups = 0;
  });

  it('issues no tokens without key', async () => {
    const { menuSlide, imageSlide, headers } = await callSignage({});
    expect(menuSlide.guestMenuAccessTokens).toBeUndefined();
    expect(imageSlide).toBeDefined();
    expect(headers['cache-control']).toBeUndefined();
    expect(state.workspaceLookups).toBe(0);
  });

  it('issues no tokens with a wrong key', async () => {
    const { menuSlide } = await callSignage({ key: 'wrong-key' });
    expect(menuSlide.guestMenuAccessTokens).toBeUndefined();
  });

  it('issues no tokens when the workspace has no key', async () => {
    state.signageKey = null;
    const { menuSlide } = await callSignage({ key: 'secret-key' });
    expect(menuSlide.guestMenuAccessTokens).toBeUndefined();
  });

  it('issues signage tokens with the valid key', async () => {
    const { menuSlide, headers } = await callSignage({ key: 'secret-key' });
    expect(menuSlide.guestMenuAccessTokens).toHaveLength(1);
    expect(verifyAccessToken(menuSlide.guestMenuAccessTokens![0])).toMatchObject({ k: 'signage', m: 'menu1', v: 2 });
    expect(headers['cache-control']).toBe('private, no-store');
  });
});

describe('/api/signage/{id} includeInactive', () => {
  beforeEach(() => {
    state.signageKey = 'secret-key';
  });

  it('is rejected without key, with a wrong key and when the workspace has no key', async () => {
    expect((await requestSignage({ includeInactive: 'true' })).status).toBe(403);
    expect((await requestSignage({ includeInactive: 'true', key: 'wrong-key' })).status).toBe(403);
    state.signageKey = null;
    const result = await requestSignage({ includeInactive: 'true', key: 'secret-key' });
    expect(result.status).toBe(403);
    expect(result.body?.error?.code).toBe('FORBIDDEN');
  });

  it('returns all slides with the valid key, never cached publicly', async () => {
    const { status, body, headers } = await requestSignage({ includeInactive: 'true', key: 'secret-key' });
    expect(status).toBe(200);
    expect(body!.content[0].slides.map((slide) => slide.id)).toEqual(['s1', 's2']);
    expect(headers['cache-control']).toBe('private, no-store');
  });

  it('rejects an invalid query', async () => {
    expect((await requestSignage({ format: 'SQUARE' })).status).toBe(400);
  });
});
