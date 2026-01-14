import { cacheService, CacheStoreName } from '../offline/CacheService';

interface FetchWithCacheOptions<T> {
  /** The URL to fetch from */
  url: string;
  /** The cache store to use */
  storeName: CacheStoreName;
  /** The workspace ID for cache key generation */
  workspaceId: string;
  /** The resource ID for cache key generation */
  resourceId: string;
  /** Optional fetch options */
  fetchOptions?: RequestInit;
  /** Extract data from response body (default: (body) => body.data) */
  extractData?: (body: unknown) => T;
  /** Called when data is loaded from cache instead of network */
  onCacheFallback?: () => void;
  /** Called when network request fails */
  onNetworkError?: (error: Error) => void;
}

interface FetchWithCacheResult<T> {
  data: T | null;
  fromCache: boolean;
  error?: Error;
}

/**
 * Fetch data with network-first, cache-fallback strategy.
 * 1. Try to fetch from network
 * 2. If successful: update cache and return data
 * 3. If failed: try to return cached data
 */
export async function fetchWithCache<T>({
  url,
  storeName,
  workspaceId,
  resourceId,
  fetchOptions,
  extractData = (body: unknown) => (body as { data: T }).data,
  onCacheFallback,
  onNetworkError,
}: FetchWithCacheOptions<T>): Promise<FetchWithCacheResult<T>> {
  try {
    // Try network first
    const response = await fetch(url, fetchOptions);

    if (response.ok) {
      const body = await response.json();
      const data = extractData(body);

      // Cache the successful response
      if (data !== null && data !== undefined) {
        await cacheService.set(storeName, workspaceId, resourceId, data);
      }

      return { data, fromCache: false };
    }

    // Network returned error status - try cache
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  } catch (error) {
    // Network failed - try cache fallback
    onNetworkError?.(error as Error);

    const cachedData = await cacheService.get<T>(storeName, workspaceId, resourceId);

    if (cachedData !== null) {
      onCacheFallback?.();
      return { data: cachedData, fromCache: true };
    }

    // No cached data available
    return { data: null, fromCache: false, error: error as Error };
  }
}

/**
 * Fetch a list of items with caching.
 * Caches both the list result and individual items.
 */
export async function fetchListWithCache<T extends { id: string }>({
  url,
  storeName,
  workspaceId,
  listKey,
  fetchOptions,
  extractData = (body: unknown) => (body as { data: T[] }).data,
  onCacheFallback,
  onNetworkError,
}: Omit<FetchWithCacheOptions<T[]>, 'resourceId'> & { listKey: string }): Promise<FetchWithCacheResult<T[]>> {
  try {
    // Try network first
    const response = await fetch(url, fetchOptions);

    if (response.ok) {
      const body = await response.json();
      const data = extractData(body);

      // Cache the list result
      await cacheService.set(storeName, workspaceId, listKey, data);

      // Also cache individual items for faster individual lookups
      if (Array.isArray(data) && data.length > 0) {
        const items = data.map((item) => ({ id: item.id, data: item }));
        await cacheService.setMany(storeName, workspaceId, items);
      }

      return { data, fromCache: false };
    }

    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  } catch (error) {
    onNetworkError?.(error as Error);

    // Try to get cached list first
    const cachedList = await cacheService.get<T[]>(storeName, workspaceId, listKey);

    if (cachedList !== null && cachedList.length > 0) {
      onCacheFallback?.();
      return { data: cachedList, fromCache: true };
    }

    // Fall back to getting all individual cached items
    const cachedItems = await cacheService.getAllForWorkspace<T>(storeName, workspaceId);

    if (cachedItems.length > 0) {
      onCacheFallback?.();
      return { data: cachedItems, fromCache: true };
    }

    return { data: null, fromCache: false, error: error as Error };
  }
}

/**
 * Prefetch and cache data for offline use
 */
export async function prefetchForOffline<T>(
  url: string,
  storeName: CacheStoreName,
  workspaceId: string,
  resourceId: string,
  extractData: (body: unknown) => T = (body: unknown) => (body as { data: T }).data,
): Promise<boolean> {
  try {
    const response = await fetch(url);
    if (response.ok) {
      const body = await response.json();
      const data = extractData(body);
      await cacheService.set(storeName, workspaceId, resourceId, data);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Prefetch and cache an image for offline use
 */
export async function prefetchImage(workspaceId: string, imageUrl: string): Promise<boolean> {
  try {
    await cacheService.cacheImage(workspaceId, imageUrl);
    return true;
  } catch {
    return false;
  }
}
