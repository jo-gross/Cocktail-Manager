/**
 * Handoff token app → customer portal (contract `contracts/portal-handoff.md` of the control plane, docs/ENTITLEMENTS.md
 * "Portal handoff"): a compact JWS with `alg: EdDSA`, signed with Node's built-in Ed25519. Pure module (node:crypto
 * only); env handling lives in `handoffConfig.ts`.
 */
import { createPrivateKey, randomBytes, sign, type KeyObject } from 'node:crypto';
import type { HandoffIntent, HandoffLocale } from './constants';

export const HANDOFF_AUDIENCE = 'portal';
/** `exp = iat + 120`, the longest lifetime the portal accepts. */
export const HANDOFF_LIFETIME_SECONDS = 120;

/** Claims in the member order of the contract (its test vector depends on it). */
export interface HandoffClaims {
  iss: string;
  aud: typeof HANDOFF_AUDIENCE;
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
  wid: string;
  wname: string;
  role: string;
  locale: HandoffLocale;
  intent: HandoffIntent;
  iat: number;
  exp: number;
  jti: string;
}

export interface HandoffSubject {
  issuer: string;
  user: { id: string; email: string; emailVerified: unknown; name: string | null };
  workspace: { id: string; name: string };
  role: string;
  locale: HandoffLocale;
  intent: HandoffIntent;
}

const HEADER = { alg: 'EdDSA', typ: 'JWT' } as const;

const b64url = (data: Buffer | string) => Buffer.from(data).toString('base64url');

/** At most `max` characters, without splitting a surrogate pair. */
function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  let out = '';
  for (const char of Array.from(value)) {
    if (out.length + char.length > max) break;
    out += char;
  }
  return out;
}

/**
 * The `iss` of the contract: the origin as `new URL(url).origin` spells it (scheme, lowercase host, port only when not
 * the default; no path, no trailing slash). `null` for anything that is not an http(s) URL.
 */
export function issuerOrigin(url: string | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.origin : null;
  } catch {
    return null;
  }
}

/** 16 random bytes (128 bit) as base64url, 22 characters. */
export function newJti(): string {
  return b64url(randomBytes(16));
}

/**
 * Builds the claims of one handoff. `email_verified` is `true` only for the boolean `true` of the user record; `name`
 * and `wname` are cut to the 200 characters the portal accepts (informational only).
 */
export function buildHandoffClaims(subject: HandoffSubject, now: Date = new Date(), jti: string = newJti()): HandoffClaims {
  const iat = Math.floor(now.getTime() / 1000);
  return {
    iss: subject.issuer,
    aud: HANDOFF_AUDIENCE,
    sub: subject.user.id,
    email: subject.user.email,
    email_verified: subject.user.emailVerified === true,
    name: truncate(subject.user.name ?? '', 200),
    wid: subject.workspace.id,
    wname: truncate(subject.workspace.name, 200),
    role: subject.role,
    locale: subject.locale,
    intent: subject.intent,
    iat,
    exp: iat + HANDOFF_LIFETIME_SECONDS,
    jti,
  };
}

/** `<header>.<payload>.<signature>`, each base64url without padding; Ed25519 over the ASCII bytes of `<header>.<payload>`. */
export function signHandoffToken(claims: HandoffClaims, privateKey: KeyObject): string {
  const input = `${b64url(JSON.stringify(HEADER))}.${b64url(JSON.stringify(claims))}`;
  return `${input}.${b64url(sign(null, Buffer.from(input), privateKey))}`;
}

/**
 * Reads `PORTAL_HANDOFF_PRIVATE_KEY` by the contract's rule: trim, strip one pair of surrounding double quotes, turn
 * every `\n` (backslash, n) into a line break, parse as PKCS#8 PEM. `null` unless it is an Ed25519 private key.
 */
export function parseHandoffPrivateKey(value: string | undefined): KeyObject | null {
  if (!value) return null;
  let pem = value.trim();
  if (pem.length >= 2 && pem.startsWith('"') && pem.endsWith('"')) pem = pem.slice(1, -1);
  pem = pem.replace(/\\n/g, '\n').trim();
  if (!pem.startsWith('-----BEGIN PRIVATE KEY-----')) return null;
  try {
    const key = createPrivateKey({ key: pem, format: 'pem' });
    return key.type === 'private' && key.asymmetricKeyType === 'ed25519' ? key : null;
  } catch {
    return null;
  }
}

/** `<portalUrl>/sso?token=…`; a path of `PORTAL_URL` is kept, a trailing slash dropped. */
export function handoffUrl(portalUrl: string, token: string): string {
  return `${portalUrl.replace(/\/+$/, '')}/sso?token=${encodeURIComponent(token)}`;
}
