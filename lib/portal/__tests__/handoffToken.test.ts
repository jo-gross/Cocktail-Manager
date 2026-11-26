import { createPublicKey, generateKeyPairSync, verify } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildHandoffClaims, handoffUrl, issuerOrigin, newJti, parseHandoffPrivateKey, signHandoffToken, type HandoffClaims } from '@lib/portal/handoffToken';

// Test vector of the contract (`contracts/portal-handoff.md` § 9, RFC 8032 test 1 key). Never use this key elsewhere.
const VECTOR_ENV = '"-----BEGIN PRIVATE KEY-----\\nMC4CAQAwBQYDK2VwBCIEIJ1hsZ3v/VpguoRK9JLsLMREScVpezJpGXA7rAMcrn9g\\n-----END PRIVATE KEY-----"';
const VECTOR_PUBLIC_KEY = '11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo';
const VECTOR_CLAIMS: HandoffClaims = {
  iss: 'https://bar.example.com',
  aud: 'portal',
  sub: 'clx0user0000000000000001',
  email: 'olivia@example.com',
  email_verified: true,
  name: 'Olivia Owner',
  wid: 'clx0ws000000000000000001',
  wname: 'Bar Olivia',
  role: 'OWNER',
  locale: 'de',
  intent: 'manage',
  iat: 1795000000,
  exp: 1795000120,
  jti: 'N2Q4YjFlNWEtM2M5Zi00YjE',
};
const VECTOR_TOKEN =
  'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2Jhci5leGFtcGxlLmNvbSIsImF1ZCI6InBvcnRhbCIsInN1YiI6ImNseDB1c2VyMDAwMDAwMDAwMDAwMDAwMSIsImVtYWlsIjoib2xpdmlhQGV4YW1wbGUuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsIm5hbWUiOiJPbGl2aWEgT3duZXIiLCJ3aWQiOiJjbHgwd3MwMDAwMDAwMDAwMDAwMDAwMDEiLCJ3bmFtZSI6IkJhciBPbGl2aWEiLCJyb2xlIjoiT1dORVIiLCJsb2NhbGUiOiJkZSIsImludGVudCI6Im1hbmFnZSIsImlhdCI6MTc5NTAwMDAwMCwiZXhwIjoxNzk1MDAwMTIwLCJqdGkiOiJOMlE0WWpGbE5XRXRNMk01WmkwMFlqRSJ9.z9nWYw-H94FfGpDZEfSjFGgcj_9_y13K5FPBIqATZ9xFhcmlgsogHyrmhryzn7IcLC9aOna-q1K-af2OYllyCQ';

const vectorPem = VECTOR_ENV.slice(1, -1).replace(/\\n/g, '\n');

function rawPublicKey(key: ReturnType<typeof parseHandoffPrivateKey>): string | undefined {
  return key ? createPublicKey(key).export({ format: 'jwk' }).x : undefined;
}

function decodePart(token: string, index: number): unknown {
  return JSON.parse(Buffer.from(token.split('.')[index], 'base64url').toString('utf8'));
}

const subject = {
  issuer: 'https://bar.example.com',
  user: { id: 'clx0user0000000000000001', email: 'olivia@example.com', emailVerified: true as unknown, name: 'Olivia Owner' as string | null },
  workspace: { id: 'clx0ws000000000000000001', name: 'Bar Olivia' },
  role: 'OWNER',
  locale: 'de' as const,
  intent: 'manage' as const,
};

describe('signHandoffToken (contract test vector)', () => {
  it('reproduces the token of the contract byte for byte', () => {
    const key = parseHandoffPrivateKey(VECTOR_ENV);
    expect(key).not.toBeNull();
    expect(rawPublicKey(key)).toBe(VECTOR_PUBLIC_KEY);
    expect(signHandoffToken(VECTOR_CLAIMS, key!)).toBe(VECTOR_TOKEN);
  });

  it('builds exactly the claims of the vector, in its member order', () => {
    const claims = buildHandoffClaims(subject, new Date(1795000000 * 1000 + 999), 'N2Q4YjFlNWEtM2M5Zi00YjE');
    expect(JSON.stringify(claims)).toBe(JSON.stringify(VECTOR_CLAIMS));
    expect(signHandoffToken(claims, parseHandoffPrivateKey(VECTOR_ENV)!)).toBe(VECTOR_TOKEN);
  });

  it('signs a verifiable compact JWS with the EdDSA header', () => {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const token = signHandoffToken(buildHandoffClaims(subject), privateKey);
    const [header, payload, signature] = token.split('.');
    expect(decodePart(token, 0)).toEqual({ alg: 'EdDSA', typ: 'JWT' });
    expect(token).not.toMatch(/[=+/]/);
    expect(verify(null, Buffer.from(`${header}.${payload}`), publicKey, Buffer.from(signature, 'base64url'))).toBe(true);
  });
});

describe('buildHandoffClaims', () => {
  it('sets aud, a lifetime of 120 s and a fresh 128-bit jti', () => {
    const now = new Date('2026-11-19T12:00:00.500Z');
    const a = buildHandoffClaims(subject, now);
    const b = buildHandoffClaims(subject, now);
    expect(a.aud).toBe('portal');
    expect(a.iat).toBe(Math.floor(now.getTime() / 1000));
    expect(a.exp - a.iat).toBe(120);
    expect(a.jti).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(Buffer.from(a.jti, 'base64url')).toHaveLength(16);
    expect(a.jti).not.toBe(b.jti);
    expect(newJti()).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it('sends email_verified as a strict boolean: true only for the boolean true', () => {
    for (const value of [true, false, 'true', 1, null, undefined]) {
      const claims = buildHandoffClaims({ ...subject, user: { ...subject.user, emailVerified: value } });
      expect(claims.email_verified).toBe(value === true);
      expect(typeof claims.email_verified).toBe('boolean');
    }
  });

  it('sends an empty name for users without one and cuts long names to 200 characters', () => {
    expect(buildHandoffClaims({ ...subject, user: { ...subject.user, name: null } }).name).toBe('');
    const long = buildHandoffClaims({ ...subject, user: { ...subject.user, name: 'x'.repeat(250) }, workspace: { id: 'w', name: '🍸'.repeat(150) } });
    expect(long.name).toHaveLength(200);
    // Emoji are two UTF-16 units; no pair is split.
    expect(long.wname).toBe('🍸'.repeat(100));
  });

  it('keeps role, locale, intent and the ids as given', () => {
    const claims = buildHandoffClaims({ ...subject, role: 'ADMIN', locale: 'en', intent: 'upgrade' });
    expect(claims).toMatchObject({
      role: 'ADMIN',
      locale: 'en',
      intent: 'upgrade',
      sub: subject.user.id,
      wid: subject.workspace.id,
      email: 'olivia@example.com',
    });
  });
});

describe('issuerOrigin', () => {
  it.each([
    ['https://bar.example.com', 'https://bar.example.com'],
    ['https://bar.example.com/', 'https://bar.example.com'],
    ['https://Bar.Example.COM/app/path?x=1#y', 'https://bar.example.com'],
    ['https://bar.example.com:443', 'https://bar.example.com'],
    ['http://bar.example.com:80/', 'http://bar.example.com'],
    ['https://bar.example.com:8443/', 'https://bar.example.com:8443'],
    ['http://localhost:3473', 'http://localhost:3473'],
    ['  https://bar.example.com  ', 'https://bar.example.com'],
  ])('%s → %s', (input, origin) => {
    expect(issuerOrigin(input)).toBe(origin);
  });

  it.each([undefined, '', '   ', 'bar.example.com', 'ftp://bar.example.com', 'not a url'])('rejects %s', (input) => {
    expect(issuerOrigin(input)).toBeNull();
  });
});

describe('parseHandoffPrivateKey', () => {
  it('accepts the PEM with real line breaks and the one-line form with \\n, with or without quotes', () => {
    const oneLine = vectorPem.replace(/\n/g, '\\n');
    for (const value of [vectorPem, `${vectorPem}\n`, `  ${vectorPem}  `, oneLine, `"${oneLine}"`, `"${vectorPem}"`]) {
      expect(rawPublicKey(parseHandoffPrivateKey(value)), JSON.stringify(value)).toBe(VECTOR_PUBLIC_KEY);
    }
  });

  it('accepts a key from openssl / generateKeyPair (PKCS#8)', () => {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const pem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
    expect(rawPublicKey(parseHandoffPrivateKey(pem))).toBe(publicKey.export({ format: 'jwk' }).x);
  });

  it('rejects everything that is not an Ed25519 private key', () => {
    const rsa = generateKeyPairSync('rsa', { modulusLength: 1024 }).privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
    const ec = generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
    const ed448 = generateKeyPairSync('ed448').privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
    const publicPem = createPublicKey(parseHandoffPrivateKey(vectorPem)!).export({ format: 'pem', type: 'spki' }).toString();
    const broken = vectorPem.replace('MC4CAQAw', 'MC4CAQAx');
    for (const value of [undefined, '', '   ', 'secret', VECTOR_PUBLIC_KEY, rsa, ec, ed448, publicPem, broken, `"${vectorPem}`, `'${vectorPem}'`]) {
      expect(parseHandoffPrivateKey(value), String(value).slice(0, 40)).toBeNull();
    }
  });
});

describe('handoffUrl', () => {
  it('appends /sso with the token as the only parameter', () => {
    expect(handoffUrl('https://portal.example.com', 'a.b.c')).toBe('https://portal.example.com/sso?token=a.b.c');
    expect(handoffUrl('https://portal.example.com/', 'a.b-_c')).toBe('https://portal.example.com/sso?token=a.b-_c');
    expect(handoffUrl('https://example.com/portal/', 'x')).toBe('https://example.com/portal/sso?token=x');
  });
});

describe('portal handoff configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  async function load() {
    vi.resetModules();
    return import('@lib/portal/handoffConfig');
  }

  function stubComplete(overrides: Record<string, string> = {}) {
    vi.stubEnv('ENTITLEMENTS_MODE', 'managed');
    vi.stubEnv('PORTAL_HANDOFF_PRIVATE_KEY', VECTOR_ENV);
    vi.stubEnv('PORTAL_URL', 'https://portal.example.com/');
    vi.stubEnv('BETTER_AUTH_URL', 'https://Bar.Example.com/');
    vi.stubEnv('NEXTAUTH_URL', '');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '');
    for (const [key, value] of Object.entries(overrides)) vi.stubEnv(key, value);
  }

  it('is available with managed mode, key, portal URL and public URL; iss is the normalised origin', async () => {
    stubComplete();
    const { portalHandoffConfig, portalHandoffAvailable } = await load();
    const config = portalHandoffConfig();
    expect(config).toMatchObject({ portalUrl: 'https://portal.example.com', issuer: 'https://bar.example.com' });
    expect(rawPublicKey(config!.privateKey)).toBe(VECTOR_PUBLIC_KEY);
    expect(portalHandoffAvailable()).toBe(true);
  });

  it('accepts the multi-line key spelling as well', async () => {
    stubComplete({ PORTAL_HANDOFF_PRIVATE_KEY: vectorPem });
    expect((await load()).portalHandoffAvailable()).toBe(true);
  });

  it('takes iss from BETTER_AUTH_URL, then NEXTAUTH_URL, then NEXT_PUBLIC_APP_URL', async () => {
    stubComplete({ BETTER_AUTH_URL: '', NEXTAUTH_URL: 'https://next.example.com:443/x', NEXT_PUBLIC_APP_URL: 'https://public.example.com' });
    expect((await load()).portalHandoffConfig()?.issuer).toBe('https://next.example.com');
    stubComplete({ BETTER_AUTH_URL: '', NEXTAUTH_URL: '', NEXT_PUBLIC_APP_URL: 'http://localhost:3473/' });
    expect((await load()).portalHandoffConfig()?.issuer).toBe('http://localhost:3473');
  });

  it('is off without ENTITLEMENTS_MODE=managed, even with a complete env', async () => {
    stubComplete({ ENTITLEMENTS_MODE: 'off' });
    expect((await load()).portalHandoffAvailable()).toBe(false);
    stubComplete({ ENTITLEMENTS_MODE: '' });
    expect((await load()).portalHandoffAvailable()).toBe(false);
  });

  it('is off without key or portal URL, silently', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    stubComplete({ PORTAL_HANDOFF_PRIVATE_KEY: '' });
    expect((await load()).portalHandoffAvailable()).toBe(false);
    stubComplete({ PORTAL_URL: '' });
    expect((await load()).portalHandoffAvailable()).toBe(false);
    expect(warn).not.toHaveBeenCalled();
  });

  it('is off with an invalid key and warns once without the value', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const rsa = generateKeyPairSync('rsa', { modulusLength: 1024 }).privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
    stubComplete({ PORTAL_HANDOFF_PRIVATE_KEY: rsa });
    const { portalHandoffAvailable } = await load();
    expect(portalHandoffAvailable()).toBe(false);
    expect(portalHandoffAvailable()).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    const message = String(warn.mock.calls[0][0]);
    expect(message).toContain('PORTAL_HANDOFF_PRIVATE_KEY');
    expect(message).not.toContain('BEGIN');
    expect(message).not.toContain(rsa.split('\n')[1].slice(0, 16));
  });

  it('is off with an invalid portal URL or without a public URL of the app', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    stubComplete({ PORTAL_URL: 'portal.example.com' });
    expect((await load()).portalHandoffAvailable()).toBe(false);
    stubComplete({ BETTER_AUTH_URL: '' });
    expect((await load()).portalHandoffAvailable()).toBe(false);
    expect(warn.mock.calls.map(([message]) => String(message).split(' ')[2])).toEqual(['PORTAL_URL', 'None']);
  });
});
