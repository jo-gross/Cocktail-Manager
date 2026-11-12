/**
 * Server-side fetch for user-supplied URLs (SSRF guard).
 *
 * - http(s) only, default ports, no credentials in the URL
 * - optional exact hostname allow-list (subdomains allowed via `.example.com`)
 * - DNS answers are checked against private/loopback/link-local ranges and
 *   pinned to the connection (no DNS rebinding)
 * - redirects are followed manually and every hop is re-checked
 * - bounded by timeout and response size; nothing is forwarded (no cookies)
 */
import { lookup } from 'node:dns/promises';
import { get as httpGet, type IncomingMessage } from 'node:http';
import { get as httpsGet } from 'node:https';
import { isIP } from 'node:net';
import { isPublicImageAddress } from '@lib/guest-menu/workspaceImage.server';

export interface SafeFetchOptions {
  /** Hostnames allowed for the initial URL and all redirects. Entries starting with `.` match subdomains. */
  allowedHosts?: string[];
  maxBytes?: number;
  timeoutMs?: number;
  maxRedirects?: number;
  /** Accepted response content types (lowercase, without parameters). Regex or exact strings. */
  accept?: Array<string | RegExp>;
  headers?: Record<string, string>;
}

export interface SafeFetchResult {
  url: string;
  status: number;
  contentType: string;
  body: Buffer;
}

export class SafeFetchError extends Error {
  constructor(
    public readonly reason:
      'INVALID_URL' | 'HOST_NOT_ALLOWED' | 'ADDRESS_NOT_ALLOWED' | 'TOO_MANY_REDIRECTS' | 'TOO_LARGE' | 'BAD_STATUS' | 'BAD_CONTENT_TYPE' | 'NETWORK',
    message: string,
  ) {
    super(message);
    this.name = 'SafeFetchError';
  }
}

const DEFAULT_MAX_BYTES = 5_000_000;
const DEFAULT_TIMEOUT_MS = 10_000;

export function isHostAllowed(hostname: string, allowedHosts: string[] | undefined): boolean {
  if (!allowedHosts) return true;
  const host = hostname.toLowerCase().replace(/\.$/, '');
  return allowedHosts.some((entry) => {
    const allowed = entry.toLowerCase();
    return allowed.startsWith('.') ? host === allowed.slice(1) || host.endsWith(allowed) : host === allowed;
  });
}

/** Parses and checks a user-supplied URL without any network access. */
export function parseSafeUrl(raw: string, allowedHosts?: string[]): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SafeFetchError('INVALID_URL', 'Invalid URL');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || (url.port && !['80', '443'].includes(url.port))) {
    throw new SafeFetchError('INVALID_URL', 'Only plain http(s) URLs on default ports are allowed');
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (!isHostAllowed(hostname, allowedHosts)) throw new SafeFetchError('HOST_NOT_ALLOWED', 'Host is not allowed');
  if (isIP(hostname) && !isPublicImageAddress(hostname)) throw new SafeFetchError('ADDRESS_NOT_ALLOWED', 'Address is not allowed');
  return url;
}

function matchesAccept(contentType: string, accept: Array<string | RegExp> | undefined): boolean {
  if (!accept) return true;
  return accept.some((entry) => (typeof entry === 'string' ? entry === contentType : entry.test(contentType)));
}

function requestOnce(url: URL, options: Required<Pick<SafeFetchOptions, 'timeoutMs'>> & SafeFetchOptions): Promise<IncomingMessage> {
  const get = url.protocol === 'https:' ? httpsGet : httpGet;
  return new Promise((resolve, reject) => {
    const request = get(
      url,
      {
        agent: false,
        signal: AbortSignal.timeout(options.timeoutMs),
        headers: { 'user-agent': 'CocktailManager/1.0 (+https://github.com/jo-gross/cocktail-manager)', ...options.headers },
        lookup: (host, lookupOptions, callback) => {
          void lookup(host, { all: true })
            .then((addresses) => {
              if (!addresses.length || addresses.some(({ address }) => !isPublicImageAddress(address))) {
                callback(new SafeFetchError('ADDRESS_NOT_ALLOWED', 'Address is not allowed'), '', 4);
                return;
              }
              const first = addresses[0];
              if (lookupOptions.all) callback(null, [first]);
              else callback(null, first.address, first.family);
            })
            .catch((error: Error) => callback(error, '', 4));
        },
      },
      resolve,
    );
    request.on('error', reject);
  });
}

export async function safeFetch(rawUrl: string, options: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxRedirects = options.maxRedirects ?? 3;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let url = parseSafeUrl(rawUrl, options.allowedHosts);

  for (let redirects = 0; ; redirects++) {
    let response: IncomingMessage;
    try {
      response = await requestOnce(url, { ...options, timeoutMs });
    } catch (error) {
      if (error instanceof SafeFetchError) throw error;
      throw new SafeFetchError('NETWORK', 'Request failed');
    }

    const status = response.statusCode ?? 0;
    if ([301, 302, 303, 307, 308].includes(status)) {
      response.destroy();
      const location = response.headers.location;
      if (!location) throw new SafeFetchError('BAD_STATUS', 'Redirect without location');
      if (redirects >= maxRedirects) throw new SafeFetchError('TOO_MANY_REDIRECTS', 'Too many redirects');
      url = parseSafeUrl(new URL(location, url).href, options.allowedHosts);
      continue;
    }

    if (status < 200 || status >= 300) {
      response.destroy();
      throw new SafeFetchError('BAD_STATUS', `Upstream responded with ${status}`);
    }

    const contentType = response.headers['content-type']?.split(';')[0].trim().toLowerCase() ?? '';
    if (!matchesAccept(contentType, options.accept)) {
      response.destroy();
      throw new SafeFetchError('BAD_CONTENT_TYPE', 'Unexpected content type');
    }
    if (Number(response.headers['content-length'] ?? 0) > maxBytes) {
      response.destroy();
      throw new SafeFetchError('TOO_LARGE', 'Response too large');
    }

    const body = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      let size = 0;
      response.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > maxBytes) {
          response.destroy();
          reject(new SafeFetchError('TOO_LARGE', 'Response too large'));
        } else chunks.push(chunk);
      });
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', () => reject(new SafeFetchError('NETWORK', 'Request failed')));
    });

    return { url: url.href, status, contentType, body };
  }
}

/** Raster image content types accepted from remote URLs (no SVG: it can carry script). */
export const REMOTE_IMAGE_CONTENT_TYPES = [/^image\/(png|jpe?g|gif|webp|avif|bmp)$/];
