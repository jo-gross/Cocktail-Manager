import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { Serwist, NetworkOnly, StaleWhileRevalidate, ExpirationPlugin } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // /queue und /ratings → immer vom Netzwerk holen (kein Cache)
    {
      matcher: /\/queue$/,
      handler: new NetworkOnly(),
    },
    {
      matcher: /\/ratings$/,
      handler: new NetworkOnly(),
    },
    // Allgemeine HTTP(S) GET-Requests → StaleWhileRevalidate
    {
      matcher: /^https?.*/,
      handler: new StaleWhileRevalidate({
        cacheName: 'http-cache',
        plugins: [
          new ExpirationPlugin({
            maxEntries: 200,
            maxAgeSeconds: 14 * 24 * 60 * 60, // 14 Tage
          }),
        ],
      }),
      method: 'GET',
    },
  ],
});

serwist.addEventListeners();
