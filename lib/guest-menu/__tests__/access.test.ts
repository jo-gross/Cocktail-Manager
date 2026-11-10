import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { IncomingMessage } from 'http';
import bcrypt from 'bcrypt';
import {
  appendUnlockQuery,
  attemptUnlock,
  collectAccessTokens,
  createGuestAccessToken,
  createMenuFailureLimiter,
  createMenuAccess,
  createSignageAccessToken,
  createUnlockLimiter,
  hashAccessCode,
  isNumericAccessCodeHash,
  isValidAccessCode,
  sanitizeReturnTo,
  serializeAccessCookie,
  signAccessToken,
  takeUnlockAttempt,
  tokenGrantsAccess,
  UNLOCK_MENU_FAILURES,
  verifyAccessCode,
  verifyAccessToken,
} from '../access';

/** Cheap bcrypt cost for tests that verify many attempts (`verifyAccessCode` accepts any cost). */
const fastHash = async (code: string) => `n:${await bcrypt.hash(code, 4)}`;

const NOW = Date.UTC(2026, 10, 10, 12, 0, 0);
const menu = { id: 'menu1', accessCodeHash: 'n:hash', accessCodeVersion: 3 };

function request(headers: Record<string, string> = {}, ip = '1.2.3.4'): IncomingMessage {
  return { headers, socket: { remoteAddress: ip } } as unknown as IncomingMessage;
}

let previousSecret: string | undefined;
beforeEach(() => {
  previousSecret = process.env.BETTER_AUTH_SECRET;
  process.env.BETTER_AUTH_SECRET = 'test-secret';
});
afterEach(() => {
  process.env.BETTER_AUTH_SECRET = previousSecret;
});

describe('access codes', () => {
  it('validates 4–12 digits or letters', () => {
    expect(isValidAccessCode('1234')).toBe(true);
    expect(isValidAccessCode('abcDEF123456')).toBe(true);
    expect(isValidAccessCode('123')).toBe(false);
    expect(isValidAccessCode('1234567890123')).toBe(false);
    expect(isValidAccessCode('12 34')).toBe(false);
    expect(isValidAccessCode('12-34')).toBe(false);
  });

  it('hashes (never stores the plain code) and verifies case-insensitively', async () => {
    const hash = await hashAccessCode('Bar42x');
    expect(hash).not.toContain('Bar42x');
    expect(hash).not.toContain('BAR42X');
    expect(isNumericAccessCodeHash(hash)).toBe(false);
    expect(await verifyAccessCode('bar42X', hash)).toBe(true);
    expect(await verifyAccessCode('bar42y', hash)).toBe(false);
    expect(await verifyAccessCode('bar42X', null)).toBe(false);
  });

  it('marks numeric codes for the keypad', async () => {
    const hash = await hashAccessCode('2580');
    expect(isNumericAccessCodeHash(hash)).toBe(true);
    expect(await verifyAccessCode(' 2580 ', hash)).toBe(true);
  });
});

describe('access tokens', () => {
  it('signs and verifies', () => {
    const { token, maxAgeSeconds } = createGuestAccessToken(menu, NOW);
    expect(maxAgeSeconds).toBe(12 * 3600);
    const payload = verifyAccessToken(token, NOW);
    expect(payload).toMatchObject({ k: 'guest', m: 'menu1', v: 3 });
    expect(tokenGrantsAccess(payload, menu)).toBe(true);
  });

  it('rejects tampered tokens and other secrets', () => {
    const { token } = createGuestAccessToken(menu, NOW);
    const [data, signature] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ k: 'guest', m: 'other', v: 3, e: NOW / 1000 + 100 })).toString('base64url');
    expect(verifyAccessToken(`${forged}.${signature}`, NOW)).toBeNull();
    expect(verifyAccessToken(`${data}.x${signature.slice(1)}`, NOW)).toBeNull();
    expect(verifyAccessToken('garbage', NOW)).toBeNull();
    process.env.BETTER_AUTH_SECRET = 'another-secret';
    expect(verifyAccessToken(token, NOW)).toBeNull();
  });

  it('expires', () => {
    const { token } = createGuestAccessToken(menu, NOW);
    expect(verifyAccessToken(token, NOW + 12 * 3600 * 1000 - 1000)).not.toBeNull();
    expect(verifyAccessToken(token, NOW + 12 * 3600 * 1000)).toBeNull();
  });

  it('is invalidated by a version bump (code changed/removed) and bound to the menu', () => {
    const payload = verifyAccessToken(createGuestAccessToken(menu, NOW).token, NOW);
    expect(tokenGrantsAccess(payload, { ...menu, accessCodeVersion: 4 })).toBe(false);
    expect(tokenGrantsAccess(payload, { ...menu, id: 'menu2' })).toBe(false);
  });

  it('signage tokens last 18–24 h and are stable within a 6 h window', () => {
    // 13:00 UTC – inside the 12:00–18:00 window.
    const at = NOW + 3600_000;
    const token = createSignageAccessToken(menu, at);
    const payload = verifyAccessToken(token, at)!;
    expect(payload.k).toBe('signage');
    const ttl = payload.e - at / 1000;
    expect(ttl).toBeGreaterThanOrEqual(18 * 3600);
    expect(ttl).toBeLessThanOrEqual(24 * 3600);
    expect(createSignageAccessToken(menu, at + 60 * 60_000)).toBe(token);
    expect(createSignageAccessToken(menu, at + 6 * 3600 * 1000)).not.toBe(token);
  });
});

describe('request tokens', () => {
  it('reads guest cookies (only under their own menu name), the header and ?access=', () => {
    const guest = createGuestAccessToken(menu, NOW).token;
    const signage = createSignageAccessToken({ ...menu, id: 'menu2' }, NOW);
    const misplaced = createGuestAccessToken({ ...menu, id: 'menu3' }, NOW).token;
    const req = request({
      cookie: `other=1; gma_menu1=${encodeURIComponent(guest)}; gma_menu9=${encodeURIComponent(misplaced)}`,
      'x-guest-menu-access': signage,
    });
    const tokens = collectAccessTokens(req, null, NOW);
    expect(tokens.map((token) => token.m).sort()).toEqual(['menu1', 'menu2']);
    expect(collectAccessTokens(request(), signage, NOW).map((token) => token.m)).toEqual(['menu2']);
  });

  it('a signage token in a cookie is ignored', () => {
    const signage = createSignageAccessToken(menu, NOW);
    expect(collectAccessTokens(request({ cookie: `gma_menu1=${encodeURIComponent(signage)}` }), null, NOW)).toEqual([]);
  });

  it('createMenuAccess: unprotected always, protected only with a matching token', () => {
    const payload = verifyAccessToken(createSignageAccessToken(menu, NOW), NOW)!;
    const access = createMenuAccess([payload]);
    expect(access.canAccess({ id: 'x', accessCodeHash: null, accessCodeVersion: 0 })).toBe(true);
    expect(access.canAccess(menu)).toBe(true);
    expect(access.canAccess({ ...menu, accessCodeVersion: 4 })).toBe(false);
    expect(access.signageTokenFor(menu)).toBe(signAccessToken(payload));
    expect(createMenuAccess([]).canAccess(menu)).toBe(false);
  });

  it('serializes an HttpOnly, SameSite=Lax cookie on path /', () => {
    const cookie = serializeAccessCookie('menu1', 'a.b', 60, true);
    expect(cookie).toContain('gma_menu1=a.b');
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Secure');
    expect(serializeAccessCookie('menu1', 'a.b', 60, false)).not.toContain('Secure');
  });
});

describe('unlock helpers', () => {
  it('rate limits 5 attempts per minute per IP + menu', () => {
    const limiter = createUnlockLimiter();
    const req = request();
    for (let i = 0; i < 5; i++) expect(takeUnlockAttempt(req, 'menu1', NOW, limiter).allowed).toBe(true);
    const blocked = takeUnlockAttempt(req, 'menu1', NOW, limiter);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    // Other menu / other IP are independent.
    expect(takeUnlockAttempt(req, 'menu2', NOW, limiter).allowed).toBe(true);
    expect(takeUnlockAttempt(request({}, '5.6.7.8'), 'menu1', NOW, limiter).allowed).toBe(true);
    // Refills over time.
    expect(takeUnlockAttempt(req, 'menu1', NOW + 12_000, limiter).allowed).toBe(true);
  });

  it('locks a menu after 30 failed attempts from any IP for a while', async () => {
    const hash = await fastHash('4711');
    const protectedMenu = { id: 'menu1', accessCodeHash: hash, accessCodeVersion: 1 };
    const limiters = { perClient: createUnlockLimiter(), perMenuFailures: createMenuFailureLimiter() };
    for (let i = 0; i < UNLOCK_MENU_FAILURES; i++) {
      // A fresh IP every time – the per-IP limit never triggers.
      const result = await attemptUnlock(request({}, `10.0.${Math.floor(i / 250)}.${i % 250}`), protectedMenu, '0000', NOW, limiters);
      expect(result).toEqual({ ok: false, reason: 'invalid' });
    }
    const locked = await attemptUnlock(request({}, '10.9.9.9'), protectedMenu, '4711', NOW, limiters);
    expect(locked.ok).toBe(false);
    expect(locked).toMatchObject({ reason: 'rateLimited' });
    expect((locked as { retryAfterSeconds: number }).retryAfterSeconds).toBeGreaterThan(0);
    // Other menus are not affected.
    expect(takeUnlockAttempt(request({}, '10.9.9.9'), 'menu2', NOW, limiters.perClient, limiters.perMenuFailures).allowed).toBe(true);
    // Refills: after the window the correct code works again.
    const later = await attemptUnlock(request({}, '10.9.9.9'), protectedMenu, '4711', NOW + 60_000, limiters);
    expect(later.ok).toBe(true);
  });

  it('does not count successful unlocks against the menu', async () => {
    const hash = await fastHash('4711');
    const protectedMenu = { id: 'menu1', accessCodeHash: hash, accessCodeVersion: 1 };
    const limiters = { perClient: createUnlockLimiter(), perMenuFailures: createMenuFailureLimiter() };
    for (let i = 0; i < UNLOCK_MENU_FAILURES + 5; i++) {
      expect((await attemptUnlock(request({}, `10.1.0.${i}`), protectedMenu, '4711', NOW, limiters)).ok).toBe(true);
    }
  });

  it('only returns to guest menu paths', () => {
    expect(sanitizeReturnTo('/m/bar/abend?lang=en', '/m/bar')).toBe('/m/bar/abend?lang=en');
    expect(sanitizeReturnTo('https://evil.example', '/m/bar')).toBe('/m/bar');
    expect(sanitizeReturnTo('//evil.example/m/x', '/m/bar')).toBe('/m/bar');
    expect(sanitizeReturnTo('/m//evil.example', '/m/bar')).toBe('/m/bar');
    expect(sanitizeReturnTo('/m/\\evil', '/m/bar')).toBe('/m/bar');
    expect(sanitizeReturnTo(42, '/m/bar')).toBe('/m/bar');
  });

  it('strips code/error state from URLs', () => {
    expect(appendUnlockQuery('/m/bar?code=1234&lang=en', {})).toBe('/m/bar?lang=en');
    expect(appendUnlockQuery('/m/bar?error=invalid', { error: 'rateLimited', retry: '30' })).toBe('/m/bar?error=rateLimited&retry=30');
    expect(appendUnlockQuery('/m/bar', {})).toBe('/m/bar');
  });
});
