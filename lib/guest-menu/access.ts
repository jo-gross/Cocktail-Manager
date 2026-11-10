/**
 * Access code protection for guest menus (server only, no DB access).
 *
 * - The code is stored as a bcrypt hash (`GuestMenu.accessCodeHash`);
 *   `accessCodeVersion` is bumped on every change and is part of every token,
 *   so changing/removing the code invalidates all issued cookies/tokens.
 * - Guests: after entering the code an HttpOnly cookie `gma_{menuId}` holds an
 *   HMAC-signed token `{ k: 'guest', m, v, e }` (12 h). Path `/` so it is also
 *   sent to `/api/public/menus/…` and `/api/public/images/…`.
 * - Signage: `/api/signage/{id}?key=…` issues `{ k: 'signage', m, v, e }` tokens
 *   (only with the workspace's monitor key, see `lib/signage/signageKey.ts`)
 *   (18–24 h, stable within a 6 h window so ETags/image URLs stay cacheable)
 *   that monitors send as `X-Guest-Menu-Access` header or `?access=` query.
 * - Secret: `BETTER_AUTH_SECRET` (fallback `NEXTAUTH_SECRET`), domain-separated.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import type { IncomingMessage } from 'http';
import bcrypt from 'bcrypt';
import { getClientIp, TokenBucketRateLimiter } from '@lib/http/rateLimit';

export const ACCESS_CODE_MIN_LENGTH = 4;
export const ACCESS_CODE_MAX_LENGTH = 12;
/** Digits or latin letters/digits (case-insensitive, stored upper-case). */
export const ACCESS_CODE_PATTERN = /^[A-Za-z0-9]{4,12}$/;

export const GUEST_ACCESS_TTL_SECONDS = 12 * 60 * 60;
const SIGNAGE_WINDOW_SECONDS = 6 * 60 * 60;
const SIGNAGE_MIN_TTL_SECONDS = 18 * 60 * 60;

export const ACCESS_COOKIE_PREFIX = 'gma_';
export const ACCESS_HEADER = 'x-guest-menu-access';

export type AccessTokenKind = 'guest' | 'signage';

export interface AccessTokenPayload {
  k: AccessTokenKind;
  /** Menu id. */
  m: string;
  /** `accessCodeVersion` at issue time. */
  v: number;
  /** Expiry (unix seconds). */
  e: number;
}

export interface ProtectedMenuRef {
  id: string;
  accessCodeHash: string | null;
  accessCodeVersion: number;
}

/** Draft preview token (`?preview=`): 256 bit, URL-safe. */
export function generatePreviewToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Trims and upper-cases a code (codes are case-insensitive). */
export function normalizeAccessCode(code: string): string {
  return code.trim().toUpperCase();
}

export function isValidAccessCode(code: string): boolean {
  return ACCESS_CODE_PATTERN.test(code.trim());
}

/**
 * Stored as `n:` / `a:` + bcrypt hash so the PIN page can pick the keyboard
 * without knowing the code (only "digits only" is revealed).
 */
const NUMERIC_MARKER = 'n:';
const ALPHANUMERIC_MARKER = 'a:';

/** Whether the PIN page should show a numeric keypad (`inputmode="numeric"`). Never reveals the code itself. */
export function isNumericAccessCodeHash(hash: string | null): boolean {
  return !!hash && hash.startsWith(NUMERIC_MARKER);
}

export async function hashAccessCode(code: string): Promise<string> {
  const normalized = normalizeAccessCode(code);
  const marker = /^[0-9]+$/.test(normalized) ? NUMERIC_MARKER : ALPHANUMERIC_MARKER;
  return marker + (await bcrypt.hash(normalized, 10));
}

export async function verifyAccessCode(code: string, storedHash: string | null): Promise<boolean> {
  if (!storedHash || !isValidAccessCode(code)) return false;
  const hash = storedHash.startsWith(NUMERIC_MARKER) || storedHash.startsWith(ALPHANUMERIC_MARKER) ? storedHash.slice(2) : storedHash;
  try {
    return await bcrypt.compare(normalizeAccessCode(code), hash);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Signed tokens
// ---------------------------------------------------------------------------

function getSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error('BETTER_AUTH_SECRET is not set');
  return secret;
}

function sign(data: string): string {
  return createHmac('sha256', getSecret()).update(`guest-menu-access:${data}`).digest('base64url');
}

export function signAccessToken(payload: AccessTokenPayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${data}.${sign(data)}`;
}

/** Signature + shape + expiry check (menu/version are checked by `tokenGrantsAccess`). */
export function verifyAccessToken(token: string | null | undefined, now = Date.now()): AccessTokenPayload | null {
  if (!token || token.length > 512) return null;
  const [data, signature, rest] = token.split('.');
  if (!data || !signature || rest !== undefined) return null;
  const expected = Buffer.from(sign(data));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as Partial<AccessTokenPayload>;
    if ((payload.k !== 'guest' && payload.k !== 'signage') || typeof payload.m !== 'string' || typeof payload.v !== 'number' || typeof payload.e !== 'number') {
      return null;
    }
    if (payload.e * 1000 <= now) return null;
    return payload as AccessTokenPayload;
  } catch {
    return null;
  }
}

export function tokenGrantsAccess(payload: AccessTokenPayload | null, menu: ProtectedMenuRef): boolean {
  return !!payload && payload.m === menu.id && payload.v === menu.accessCodeVersion;
}

export function createGuestAccessToken(menu: ProtectedMenuRef, now = Date.now()): { token: string; maxAgeSeconds: number } {
  const e = Math.floor(now / 1000) + GUEST_ACCESS_TTL_SECONDS;
  return { token: signAccessToken({ k: 'guest', m: menu.id, v: menu.accessCodeVersion, e }), maxAgeSeconds: GUEST_ACCESS_TTL_SECONDS };
}

/** 18–24 h, identical within a 6 h window (stable image URLs / ETags across signage polls). */
export function createSignageAccessToken(menu: ProtectedMenuRef, now = Date.now()): string {
  const nowSeconds = Math.floor(now / 1000);
  const e = Math.ceil(nowSeconds / SIGNAGE_WINDOW_SECONDS) * SIGNAGE_WINDOW_SECONDS + SIGNAGE_MIN_TTL_SECONDS;
  return signAccessToken({ k: 'signage', m: menu.id, v: menu.accessCodeVersion, e });
}

// ---------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------

export function accessCookieName(menuId: string): string {
  return `${ACCESS_COOKIE_PREFIX}${menuId}`;
}

function parseCookies(header: string | undefined): Map<string, string> {
  const cookies = new Map<string, string>();
  if (!header) return cookies;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const name = part.slice(0, index).trim();
    if (!name.startsWith(ACCESS_COOKIE_PREFIX)) continue;
    try {
      cookies.set(name, decodeURIComponent(part.slice(index + 1).trim()));
    } catch {
      // malformed – ignore
    }
  }
  return cookies;
}

function headerValue(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Valid (signature + expiry) access tokens of a request: `gma_*` cookies,
 * `X-Guest-Menu-Access` header (comma separated) and `?access=` (comma separated).
 */
export function collectAccessTokens(req: IncomingMessage, queryAccess?: string | string[] | null, now = Date.now()): AccessTokenPayload[] {
  const raw: string[] = [];
  for (const [name, value] of parseCookies(headerValue(req, 'cookie'))) {
    const payload = verifyAccessToken(value, now);
    // Cookies are bound to their menu (name) and are guest tokens only.
    if (payload && payload.k === 'guest' && name === accessCookieName(payload.m)) raw.push(value);
  }
  const header = headerValue(req, ACCESS_HEADER);
  if (header) raw.push(...header.split(','));
  const query = Array.isArray(queryAccess) ? queryAccess.join(',') : queryAccess;
  if (query) raw.push(...query.split(','));
  const result: AccessTokenPayload[] = [];
  for (const token of raw.slice(0, 20)) {
    const payload = verifyAccessToken(token.trim(), now);
    if (payload) result.push(payload);
  }
  return result;
}

/** Access checker for `loadPublicMenu` / the image endpoint. */
export interface MenuAccess {
  /** True if the menu is unprotected or one of the tokens grants access. */
  canAccess(menu: ProtectedMenuRef): boolean;
  /** Signage token for `menu` (appended to image URLs as `?access=`), if the request carried one. */
  signageTokenFor(menu: ProtectedMenuRef): string | null;
}

export function createMenuAccess(tokens: AccessTokenPayload[]): MenuAccess {
  return {
    canAccess: (menu) => !menu.accessCodeHash || tokens.some((payload) => tokenGrantsAccess(payload, menu)),
    signageTokenFor: (menu) => {
      const payload = tokens.find((candidate) => candidate.k === 'signage' && tokenGrantsAccess(candidate, menu));
      return payload ? signAccessToken(payload) : null;
    },
  };
}

export const NO_MENU_ACCESS: MenuAccess = createMenuAccess([]);

export function isSecureRequest(req: IncomingMessage): boolean {
  const proto = headerValue(req, 'x-forwarded-proto')?.split(',')[0].trim();
  if (proto) return proto === 'https';
  return !!(req.socket as { encrypted?: boolean } | undefined)?.encrypted;
}

export function serializeAccessCookie(menuId: string, token: string, maxAgeSeconds: number, secure: boolean): string {
  return [
    `${accessCookieName(menuId)}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${maxAgeSeconds}`,
    'HttpOnly',
    'SameSite=Lax',
    ...(secure ? ['Secure'] : []),
  ].join('; ');
}

// ---------------------------------------------------------------------------
// Unlock flow
// ---------------------------------------------------------------------------

/** Only same-site guest menu paths (`/m/…`), never protocol-relative or absolute URLs. */
export function sanitizeReturnTo(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || value.length > 512) return fallback;
  if (!/^\/m\/[^/\\]/.test(value) || value.includes('\\')) return fallback;
  return value;
}

/** Replaces the unlock state params (`error`, `retry`, `code`) of a path. */
export function appendUnlockQuery(path: string, params: Record<string, string>): string {
  const [base, search = ''] = path.split('?', 2);
  const query = new URLSearchParams(search);
  query.delete('error');
  query.delete('retry');
  query.delete('code');
  for (const [key, value] of Object.entries(params)) query.set(key, value);
  const result = query.toString();
  return result ? `${base}?${result}` : base;
}

// ---------------------------------------------------------------------------
// Attempt rate limits
// - per IP + menu: 5 attempts per minute (see `TRUST_PROXY` for the client IP)
// - per menu (any IP): 30 failed attempts per 10 minutes, so rotating IPs
//   doesn't help brute forcing a short code. Guests with a valid cookie are
//   not affected; new guests see the lockout message until it refills.
// ---------------------------------------------------------------------------

export const UNLOCK_ATTEMPTS_PER_MINUTE = 5;
export const UNLOCK_MENU_FAILURES = 30;
export const UNLOCK_MENU_FAILURE_WINDOW_SECONDS = 10 * 60;

export function createUnlockLimiter(): TokenBucketRateLimiter {
  return new TokenBucketRateLimiter({ capacity: UNLOCK_ATTEMPTS_PER_MINUTE, refillPerSecond: UNLOCK_ATTEMPTS_PER_MINUTE / 60 });
}

export function createMenuFailureLimiter(): TokenBucketRateLimiter {
  return new TokenBucketRateLimiter({ capacity: UNLOCK_MENU_FAILURES, refillPerSecond: UNLOCK_MENU_FAILURES / UNLOCK_MENU_FAILURE_WINDOW_SECONDS });
}

const unlockLimiter = createUnlockLimiter();
const menuFailureLimiter = createMenuFailureLimiter();

export interface UnlockLimiters {
  perClient: TokenBucketRateLimiter;
  perMenuFailures: TokenBucketRateLimiter;
}

const defaultLimiters: UnlockLimiters = { perClient: unlockLimiter, perMenuFailures: menuFailureLimiter };

/** Consumes one unlock attempt; `allowed: false` → show the lockout message (retry after `retryAfterSeconds`). */
export function takeUnlockAttempt(
  req: IncomingMessage,
  menuId: string,
  now = Date.now(),
  limiter = unlockLimiter,
  failureLimiter = menuFailureLimiter,
): { allowed: boolean; retryAfterSeconds: number } {
  const menuState = failureLimiter.peek(`unlock-failures:${menuId}`, now);
  if (!menuState.allowed) return menuState;
  return limiter.take(`unlock:${menuId}:${getClientIp(req)}`, now);
}

/** Counts a wrong code against the per-menu budget. */
export function recordUnlockFailure(menuId: string, now = Date.now(), failureLimiter = menuFailureLimiter): void {
  failureLimiter.take(`unlock-failures:${menuId}`, now);
}

export type UnlockResult = { ok: true; cookie: string } | { ok: false; reason: 'invalid' | 'rateLimited'; retryAfterSeconds?: number };

/** Rate limits → bcrypt check → cookie. Shared by the unlock endpoint and `/m/…?code=`. */
export async function attemptUnlock(
  req: IncomingMessage,
  menu: ProtectedMenuRef,
  code: string,
  now = Date.now(),
  limiters: UnlockLimiters = defaultLimiters,
): Promise<UnlockResult> {
  const attempt = takeUnlockAttempt(req, menu.id, now, limiters.perClient, limiters.perMenuFailures);
  if (!attempt.allowed) return { ok: false, reason: 'rateLimited', retryAfterSeconds: attempt.retryAfterSeconds };
  if (!(await verifyAccessCode(code, menu.accessCodeHash))) {
    recordUnlockFailure(menu.id, now, limiters.perMenuFailures);
    return { ok: false, reason: 'invalid' };
  }
  const { token, maxAgeSeconds } = createGuestAccessToken(menu, now);
  return { ok: true, cookie: serializeAccessCookie(menu.id, token, maxAgeSeconds, isSecureRequest(req)) };
}
