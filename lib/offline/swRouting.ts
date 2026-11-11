/**
 * Request classification for the service worker runtime caching (service-worker/index.ts).
 * Kept free of Serwist/DOM types so the routing rules are unit-testable.
 *
 * - `network-only`: never cached (live data, guest menus, auth flows).
 * - `api-image`: entity images under /api/v1/… → network first, cached copy only when offline.
 * - `api`: other same-origin /api/ GETs → network first, cached copy only when offline.
 *   Online reads must always reflect the latest save; the bartender offline mode keeps
 *   working through this fallback plus the IndexedDB layer (lib/offline/CacheService).
 * - `page`: navigations → network first (fresh HTML after deploys, offline fallback).
 * - `static`: everything else (fonts, static files, cross-origin assets) → stale-while-revalidate.
 */
export type SwCacheStrategy = 'network-only' | 'api-image' | 'api' | 'page' | 'static';

export interface SwRequestInfo {
  url: URL;
  sameOrigin: boolean;
  /** `Request.mode`; `'navigate'` for document navigations. */
  mode?: string;
}

/** Cache names used by the service worker. */
export const SW_CACHE_NAMES = {
  api: 'api-cache',
  apiImages: 'api-images',
  pages: 'pages',
  static: 'static-resources',
} as const;

/**
 * Caches from older service worker versions. `http-cache` held a stale-while-revalidate copy of
 * every GET – including authenticated /api/ JSON – and is purged on activation.
 */
export const SW_LEGACY_CACHE_NAMES = ['http-cache'];

const ENTITY_IMAGE_PATH = /^\/api\/v1\/workspaces\/[^/]+\/(?:cocktails|ingredients|garnishes|glasses|admin\/signage\/slides)\/[^/]+\/image$/;

function isGuestMenuPath(pathname: string): boolean {
  // incl. client navigation data: /_next/data/{buildId}/m/….json
  return pathname.startsWith('/m/') || pathname.startsWith('/api/public/') || /^\/_next\/data\/[^/]+\/m\//.test(pathname);
}

export function classifySwRequest({ url, sameOrigin, mode }: SwRequestInfo): SwCacheStrategy {
  const { pathname } = url;

  // Queue and ratings change constantly → always from the network
  if (/\/queue$/.test(pathname) || /\/ratings$/.test(pathname)) return 'network-only';

  if (sameOrigin) {
    // Guest menus: protected menus must not stay readable longer than the access cookie
    if (isGuestMenuPath(pathname)) return 'network-only';

    // Auth flows (OAuth callbacks, sign-out, …) must never be answered from a cache. The session
    // lookup stays cacheable so the offline bartender view can start without network.
    if (pathname.startsWith('/api/auth/') && pathname !== '/api/auth/get-session') return 'network-only';

    if (ENTITY_IMAGE_PATH.test(pathname)) return 'api-image';
    if (pathname.startsWith('/api/')) return 'api';
  }

  if (mode === 'navigate') return 'page';
  return 'static';
}
