import { cacheService, CacheStoreName } from './CacheService';
import { SW_CACHE_NAMES, SW_LEGACY_CACHE_NAMES } from './swRouting';

export interface OfflineCacheEntryRef {
  storeName: CacheStoreName;
  workspaceId: string;
  resourceId: string;
}

const ENTITY_MUTATION_PATH = /^\/api\/v1\/workspaces\/([^/?#]+)\/(cocktails|cards)\/([^/?#]+)/;

/**
 * IndexedDB entries (see lib/network/cocktails.ts, cards.ts) that a successful mutation of `path`
 * makes stale. Covers sub-resources too, e.g. PUT …/cocktails/{id}/availability.
 */
export function offlineCacheEntriesForMutation(path: string): OfflineCacheEntryRef[] {
  const match = ENTITY_MUTATION_PATH.exec(path);
  if (!match) return [];
  const [, workspaceId, resource, id] = match;

  if (resource === 'cocktails') {
    // `{id}-full` = detail DTO (fetchCocktail / prefetchCardData), `{id}` = summary from the list prefetch
    return [
      { storeName: 'cocktails', workspaceId, resourceId: `${id}-full` },
      { storeName: 'cocktails', workspaceId, resourceId: id },
    ];
  }
  return [{ storeName: 'cards', workspaceId, resourceId: id }];
}

/**
 * Drops offline copies made stale by a successful mutation, so the offline view never shows
 * pre-save data. Online reads are network first and refill the cache.
 */
export async function invalidateOfflineCacheForMutation(path: string): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  await Promise.all(offlineCacheEntriesForMutation(path).map((entry) => cacheService.delete(entry.storeName, entry.workspaceId, entry.resourceId)));
}

/**
 * Removes all locally stored workspace data (IndexedDB + service worker API caches),
 * e.g. after sign-out so the next user of a shared device cannot read it.
 */
export async function clearOfflineData(): Promise<void> {
  const tasks: Promise<unknown>[] = [];
  if (typeof indexedDB !== 'undefined') tasks.push(cacheService.clearAll());
  if (typeof caches !== 'undefined') {
    tasks.push(...[SW_CACHE_NAMES.api, SW_CACHE_NAMES.apiImages, SW_CACHE_NAMES.pages, ...SW_LEGACY_CACHE_NAMES].map((name) => caches.delete(name)));
  }
  await Promise.allSettled(tasks);
}
