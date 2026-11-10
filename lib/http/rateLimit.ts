/**
 * Simple in-memory token bucket rate limiter for public, unauthenticated
 * endpoints (guest menus, public images). Per process – good enough to stop
 * naive scraping/flooding; put a reverse proxy limit in front for more.
 */
import type { IncomingMessage, ServerResponse } from 'http';

export interface RateLimiterOptions {
  /** Max burst size. */
  capacity: number;
  /** Tokens added per second. */
  refillPerSecond: number;
  /** Max tracked keys (oldest are evicted). */
  maxKeys?: number;
}

interface Bucket {
  tokens: number;
  updatedAt: number;
}

export class TokenBucketRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(private readonly options: RateLimiterOptions) {}

  /** Like `take` but without consuming a token (and without touching the bucket). */
  peek(key: string, now = Date.now()): { allowed: boolean; retryAfterSeconds: number } {
    const { capacity, refillPerSecond } = this.options;
    const bucket = this.buckets.get(key);
    const tokens = bucket ? Math.min(capacity, bucket.tokens + ((now - bucket.updatedAt) / 1000) * refillPerSecond) : capacity;
    if (tokens >= 1) return { allowed: true, retryAfterSeconds: 0 };
    return { allowed: false, retryAfterSeconds: Math.ceil((1 - tokens) / refillPerSecond) };
  }

  /** Consumes one token; returns `{ allowed, retryAfterSeconds }`. */
  take(key: string, now = Date.now()): { allowed: boolean; retryAfterSeconds: number } {
    const { capacity, refillPerSecond } = this.options;
    const bucket = this.buckets.get(key) ?? { tokens: capacity, updatedAt: now };
    bucket.tokens = Math.min(capacity, bucket.tokens + ((now - bucket.updatedAt) / 1000) * refillPerSecond);
    bucket.updatedAt = now;

    // Re-insert to keep Map order = least recently used first.
    this.buckets.delete(key);
    this.buckets.set(key, bucket);
    if (this.buckets.size > (this.options.maxKeys ?? 10_000)) {
      const oldest = this.buckets.keys().next().value;
      if (oldest !== undefined) this.buckets.delete(oldest);
    }

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return { allowed: true, retryAfterSeconds: 0 };
    }
    return { allowed: false, retryAfterSeconds: Math.ceil((1 - bucket.tokens) / refillPerSecond) };
  }
}

export type TrustProxySetting = { mode: 'none' } | { mode: 'hops'; hops: number } | { mode: 'cloudflare' };

/**
 * `TRUST_PROXY` (see docs/ENV.md): unset/`false` → socket address only (client headers
 * can't be spoofed, but behind a reverse proxy all clients share one bucket);
 * `true`/N → N-th `X-Forwarded-For` entry from the right (`true` = 1 = rightmost, i.e.
 * the address the nearest proxy saw), fallback `X-Real-IP`; `cloudflare` → `CF-Connecting-IP`.
 */
export function parseTrustProxy(value: string | undefined): TrustProxySetting {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || normalized === 'false' || normalized === '0') return { mode: 'none' };
  if (normalized === 'cloudflare') return { mode: 'cloudflare' };
  if (normalized === 'true') return { mode: 'hops', hops: 1 };
  const hops = Number(normalized);
  if (Number.isInteger(hops) && hops > 0) return { mode: 'hops', hops };
  console.warn(`[rateLimit] Invalid TRUST_PROXY value "${value}" – ignoring proxy headers (expected true, false, a number of hops or "cloudflare").`);
  return { mode: 'none' };
}

function firstHeader(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name];
  return (Array.isArray(value) ? value.join(',') : value)?.trim() || undefined;
}

let cachedTrustProxy: { raw: string | undefined; setting: TrustProxySetting } | null = null;

function trustProxyFromEnv(): TrustProxySetting {
  const raw = process.env.TRUST_PROXY;
  if (!cachedTrustProxy || cachedTrustProxy.raw !== raw) cachedTrustProxy = { raw, setting: parseTrustProxy(raw) };
  return cachedTrustProxy.setting;
}

let warnedUntrustedForwardedFor = false;

export function getClientIp(req: IncomingMessage, trustProxy: TrustProxySetting = trustProxyFromEnv()): string {
  const socketAddress = req.socket?.remoteAddress || 'unknown';
  switch (trustProxy.mode) {
    case 'cloudflare':
      return firstHeader(req, 'cf-connecting-ip')?.split(',')[0].trim() || socketAddress;
    case 'hops': {
      const entries = (firstHeader(req, 'x-forwarded-for') ?? '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
      // Fewer entries than hops → the leftmost one (all of them came through trusted proxies).
      if (entries.length > 0) return entries[Math.max(0, entries.length - trustProxy.hops)];
      return firstHeader(req, 'x-real-ip') || socketAddress;
    }
    default:
      if (!warnedUntrustedForwardedFor && req.headers['x-forwarded-for']) {
        warnedUntrustedForwardedFor = true;
        console.warn(
          '[rateLimit] Request has an X-Forwarded-For header but TRUST_PROXY is not set – rate limits use the socket address, so behind a reverse proxy all clients share one bucket. Set TRUST_PROXY=true (or the number of proxies / "cloudflare"), see docs/ENV.md.',
        );
      }
      return socketAddress;
  }
}

/** Applies the limiter; on rejection sends 429 and returns false. */
export function applyRateLimit(limiter: TokenBucketRateLimiter, req: IncomingMessage, res: ServerResponse, scope = ''): boolean {
  const result = limiter.take(`${scope}:${getClientIp(req)}`);
  if (result.allowed) return true;
  res.statusCode = 429;
  res.setHeader('Retry-After', String(result.retryAfterSeconds));
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: { code: 'RATE_LIMITED', message: 'Too many requests' } }));
  return false;
}
