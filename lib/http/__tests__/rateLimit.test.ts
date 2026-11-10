import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IncomingMessage } from 'http';
import { getClientIp, parseTrustProxy, TokenBucketRateLimiter } from '../rateLimit';

function request(headers: Record<string, string> = {}, ip = '10.0.0.1'): IncomingMessage {
  return { headers, socket: { remoteAddress: ip } } as unknown as IncomingMessage;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('parseTrustProxy', () => {
  it('parses the supported values', () => {
    expect(parseTrustProxy(undefined)).toEqual({ mode: 'none' });
    expect(parseTrustProxy('')).toEqual({ mode: 'none' });
    expect(parseTrustProxy('false')).toEqual({ mode: 'none' });
    expect(parseTrustProxy('true')).toEqual({ mode: 'hops', hops: 1 });
    expect(parseTrustProxy('TRUE')).toEqual({ mode: 'hops', hops: 1 });
    expect(parseTrustProxy('2')).toEqual({ mode: 'hops', hops: 2 });
    expect(parseTrustProxy('cloudflare')).toEqual({ mode: 'cloudflare' });
  });

  it('ignores invalid values', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(parseTrustProxy('yes please')).toEqual({ mode: 'none' });
    expect(parseTrustProxy('-1')).toEqual({ mode: 'none' });
  });
});

describe('getClientIp', () => {
  const forwarded = { 'x-forwarded-for': '6.6.6.6, 1.1.1.1, 2.2.2.2', 'x-real-ip': '3.3.3.3', 'cf-connecting-ip': '4.4.4.4' };

  it('uses only the socket address without TRUST_PROXY (spoofed headers are ignored)', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(getClientIp(request(forwarded), { mode: 'none' })).toBe('10.0.0.1');
    expect(getClientIp(request({}, ''), { mode: 'none' })).toBe('unknown');
  });

  it('counts X-Forwarded-For hops from the right', () => {
    expect(getClientIp(request(forwarded), { mode: 'hops', hops: 1 })).toBe('2.2.2.2');
    expect(getClientIp(request(forwarded), { mode: 'hops', hops: 2 })).toBe('1.1.1.1');
    // More hops than entries → leftmost entry.
    expect(getClientIp(request(forwarded), { mode: 'hops', hops: 5 })).toBe('6.6.6.6');
  });

  it('falls back to X-Real-IP and the socket address in hops mode', () => {
    expect(getClientIp(request({ 'x-real-ip': '3.3.3.3' }), { mode: 'hops', hops: 1 })).toBe('3.3.3.3');
    expect(getClientIp(request(), { mode: 'hops', hops: 1 })).toBe('10.0.0.1');
  });

  it('uses CF-Connecting-IP in cloudflare mode', () => {
    expect(getClientIp(request(forwarded), { mode: 'cloudflare' })).toBe('4.4.4.4');
    expect(getClientIp(request({ 'x-forwarded-for': '6.6.6.6' }), { mode: 'cloudflare' })).toBe('10.0.0.1');
  });

  it('reads TRUST_PROXY from the environment', () => {
    vi.stubEnv('TRUST_PROXY', 'true');
    expect(getClientIp(request(forwarded))).toBe('2.2.2.2');
    vi.stubEnv('TRUST_PROXY', 'cloudflare');
    expect(getClientIp(request(forwarded))).toBe('4.4.4.4');
    vi.unstubAllEnvs();
  });
});

describe('TokenBucketRateLimiter.peek', () => {
  it('does not consume tokens', () => {
    const limiter = new TokenBucketRateLimiter({ capacity: 1, refillPerSecond: 1 });
    expect(limiter.peek('a', 0).allowed).toBe(true);
    expect(limiter.take('a', 0).allowed).toBe(true);
    expect(limiter.peek('a', 0)).toEqual({ allowed: false, retryAfterSeconds: 1 });
    expect(limiter.peek('a', 1000).allowed).toBe(true);
  });
});
