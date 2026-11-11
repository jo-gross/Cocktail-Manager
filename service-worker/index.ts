import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { Serwist, NetworkFirst, NetworkOnly, StaleWhileRevalidate, ExpirationPlugin } from 'serwist';
import { classifySwRequest, SW_CACHE_NAMES, SW_LEGACY_CACHE_NAMES } from '../lib/offline/swRouting';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const FOURTEEN_DAYS = 14 * 24 * 60 * 60;

// Routing rules live in lib/offline/swRouting.ts (unit-tested).
// API data is network first: online reads always show the latest saved state, the cached copy
// is only used when the network fails (offline bartender view).
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({ url, sameOrigin, request }) => classifySwRequest({ url, sameOrigin, mode: request.mode }) === 'network-only',
      handler: new NetworkOnly(),
    },
    {
      matcher: ({ url, sameOrigin, request }) => classifySwRequest({ url, sameOrigin, mode: request.mode }) === 'api-image',
      handler: new NetworkFirst({
        cacheName: SW_CACHE_NAMES.apiImages,
        plugins: [new ExpirationPlugin({ maxEntries: 500, maxAgeSeconds: FOURTEEN_DAYS })],
      }),
      method: 'GET',
    },
    {
      matcher: ({ url, sameOrigin, request }) => classifySwRequest({ url, sameOrigin, mode: request.mode }) === 'api',
      handler: new NetworkFirst({
        cacheName: SW_CACHE_NAMES.api,
        plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: FOURTEEN_DAYS })],
      }),
      method: 'GET',
    },
    {
      matcher: ({ url, sameOrigin, request }) => classifySwRequest({ url, sameOrigin, mode: request.mode }) === 'page',
      handler: new NetworkFirst({
        cacheName: SW_CACHE_NAMES.pages,
        plugins: [new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: FOURTEEN_DAYS })],
      }),
      method: 'GET',
    },
    // Remaining HTTP(S) GET requests (static files, fonts, external assets) → StaleWhileRevalidate
    {
      matcher: /^https?.*/,
      handler: new StaleWhileRevalidate({
        cacheName: SW_CACHE_NAMES.static,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 200,
            maxAgeSeconds: FOURTEEN_DAYS,
          }),
        ],
      }),
      method: 'GET',
    },
  ],
});

// Drop caches of older SW versions (they hold stale, partly authenticated API responses).
self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all(SW_LEGACY_CACHE_NAMES.map((name) => caches.delete(name))));
});

serwist.addEventListeners();
