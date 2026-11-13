/**
 * Short-lived login token for demo users. `/api/demo/create-workspace` issues it
 * for the user it just created; `/api/auth/demo-login` only creates a session for
 * a valid token (HMAC-SHA256 with BETTER_AUTH_SECRET, bound to the user id and an
 * expiry). It is single-use because demo-login refuses users that already have a
 * session.
 */
import { createHmac, timingSafeEqual } from 'crypto';

export const DEMO_LOGIN_TOKEN_TTL_MS = 5 * 60 * 1000;

const TOKEN_PURPOSE = 'demo-login:v1';

function getSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error('BETTER_AUTH_SECRET is required for demo login tokens');
  return secret;
}

function sign(userId: string, expiresAt: number): string {
  return createHmac('sha256', getSecret()).update(`${TOKEN_PURPOSE}:${userId}:${expiresAt}`).digest('base64url');
}

export function createDemoLoginToken(userId: string, now = Date.now()): string {
  const expiresAt = now + DEMO_LOGIN_TOKEN_TTL_MS;
  return `${userId}.${expiresAt}.${sign(userId, expiresAt)}`;
}

/** Returns the user id the token was issued for, or null if it is malformed, forged or expired. */
export function verifyDemoLoginToken(token: string, now = Date.now()): string | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [userId, expiresAtRaw, signature] = parts;
  const expiresAt = Number(expiresAtRaw);
  if (!userId || !/^\d+$/.test(expiresAtRaw) || !Number.isSafeInteger(expiresAt) || expiresAt < now) return null;

  const expected = Buffer.from(sign(userId, expiresAt));
  const actual = Buffer.from(signature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  return userId;
}
