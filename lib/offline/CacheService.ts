/**
 * IndexedDB Cache Service for offline functionality
 * Provides caching for cocktails, cards, images, and related data
 */

const DB_NAME = 'cocktail-manager-cache';
const DB_VERSION = 1;

export type CacheStoreName = 'cocktails' | 'cards' | 'images' | 'glasses' | 'garnishes' | 'ingredients' | 'search-results';

interface CacheEntry<T> {
  key: string;
  data: T;
  timestamp: number;
  workspaceId: string;
}

class CacheService {
  private db: IDBDatabase | null = null;
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (this.db) {
      return Promise.resolve(this.db);
    }

    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        reject(new Error('IndexedDB is not available on server side'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores for different data types
        const stores: CacheStoreName[] = ['cocktails', 'cards', 'images', 'glasses', 'garnishes', 'ingredients', 'search-results'];

        stores.forEach((storeName) => {
          if (!db.objectStoreNames.contains(storeName)) {
            const store = db.createObjectStore(storeName, { keyPath: 'key' });
            store.createIndex('workspaceId', 'workspaceId', { unique: false });
            store.createIndex('timestamp', 'timestamp', { unique: false });
          }
        });
      };
    });

    return this.dbPromise;
  }

  /**
   * Generate a cache key for a given resource
   */
  private generateKey(workspaceId: string, resourceType: string, resourceId?: string): string {
    if (resourceId) {
      return `${workspaceId}:${resourceType}:${resourceId}`;
    }
    return `${workspaceId}:${resourceType}`;
  }

  /**
   * Store data in the cache
   */
  async set<T>(storeName: CacheStoreName, workspaceId: string, resourceId: string, data: T): Promise<void> {
    try {
      const db = await this.getDB();
      const key = this.generateKey(workspaceId, storeName, resourceId);

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);

        const entry: CacheEntry<T> = {
          key,
          data,
          timestamp: Date.now(),
          workspaceId,
        };

        const request = store.put(entry);

        request.onsuccess = () => resolve();
        request.onerror = () => {
          console.error(`Failed to cache ${storeName}:`, request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error(`CacheService.set error for ${storeName}:`, error);
    }
  }

  /**
   * Retrieve data from the cache
   */
  async get<T>(storeName: CacheStoreName, workspaceId: string, resourceId: string): Promise<T | null> {
    try {
      const db = await this.getDB();
      const key = this.generateKey(workspaceId, storeName, resourceId);

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);

        request.onsuccess = () => {
          const entry = request.result as CacheEntry<T> | undefined;
          resolve(entry?.data ?? null);
        };
        request.onerror = () => {
          console.error(`Failed to get ${storeName} from cache:`, request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error(`CacheService.get error for ${storeName}:`, error);
      return null;
    }
  }

  /**
   * Get all entries for a workspace from a store
   */
  async getAllForWorkspace<T>(storeName: CacheStoreName, workspaceId: string): Promise<T[]> {
    try {
      const db = await this.getDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const index = store.index('workspaceId');
        const request = index.getAll(workspaceId);

        request.onsuccess = () => {
          const entries = request.result as CacheEntry<T>[];
          resolve(entries.map((entry) => entry.data));
        };
        request.onerror = () => {
          console.error(`Failed to get all ${storeName} from cache:`, request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error(`CacheService.getAllForWorkspace error for ${storeName}:`, error);
      return [];
    }
  }

  /**
   * Store multiple items at once
   */
  async setMany<T>(storeName: CacheStoreName, workspaceId: string, items: { id: string; data: T }[]): Promise<void> {
    try {
      const db = await this.getDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const timestamp = Date.now();

        items.forEach((item) => {
          const key = this.generateKey(workspaceId, storeName, item.id);
          const entry: CacheEntry<T> = {
            key,
            data: item.data,
            timestamp,
            workspaceId,
          };
          store.put(entry);
        });

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => {
          console.error(`Failed to cache multiple ${storeName}:`, transaction.error);
          reject(transaction.error);
        };
      });
    } catch (error) {
      console.error(`CacheService.setMany error for ${storeName}:`, error);
    }
  }

  /**
   * Delete a specific entry from the cache
   */
  async delete(storeName: CacheStoreName, workspaceId: string, resourceId: string): Promise<void> {
    try {
      const db = await this.getDB();
      const key = this.generateKey(workspaceId, storeName, resourceId);

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(key);

        request.onsuccess = () => resolve();
        request.onerror = () => {
          console.error(`Failed to delete ${storeName} from cache:`, request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error(`CacheService.delete error for ${storeName}:`, error);
    }
  }

  /**
   * Clear all data for a specific workspace
   */
  async clearWorkspace(workspaceId: string): Promise<void> {
    try {
      const db = await this.getDB();
      const stores: CacheStoreName[] = ['cocktails', 'cards', 'images', 'glasses', 'garnishes', 'ingredients', 'search-results'];

      for (const storeName of stores) {
        await new Promise<void>((resolve, reject) => {
          const transaction = db.transaction(storeName, 'readwrite');
          const store = transaction.objectStore(storeName);
          const index = store.index('workspaceId');
          const request = index.openCursor(workspaceId);

          request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
              cursor.delete();
              cursor.continue();
            } else {
              resolve();
            }
          };
          request.onerror = () => reject(request.error);
        });
      }
    } catch (error) {
      console.error('CacheService.clearWorkspace error:', error);
    }
  }

  /**
   * Clear all cached data
   */
  async clearAll(): Promise<void> {
    try {
      const db = await this.getDB();
      const stores: CacheStoreName[] = ['cocktails', 'cards', 'images', 'glasses', 'garnishes', 'ingredients', 'search-results'];

      for (const storeName of stores) {
        await new Promise<void>((resolve, reject) => {
          const transaction = db.transaction(storeName, 'readwrite');
          const store = transaction.objectStore(storeName);
          const request = store.clear();

          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      }
    } catch (error) {
      console.error('CacheService.clearAll error:', error);
    }
  }

  /**
   * Check if a resource exists in cache
   */
  async has(storeName: CacheStoreName, workspaceId: string, resourceId: string): Promise<boolean> {
    const data = await this.get(storeName, workspaceId, resourceId);
    return data !== null;
  }

  /**
   * Store an image as a blob URL
   */
  async cacheImage(workspaceId: string, imageUrl: string): Promise<void> {
    try {
      // Check if already cached
      const existing = await this.get<string>('images', workspaceId, imageUrl);
      if (existing) return;

      const response = await fetch(imageUrl);
      if (!response.ok) return;

      const blob = await response.blob();
      const base64 = await this.blobToBase64(blob);

      await this.set('images', workspaceId, imageUrl, base64);
    } catch (error) {
      console.error('Failed to cache image:', imageUrl, error);
    }
  }

  /**
   * Get cached image as data URL
   */
  async getCachedImage(workspaceId: string, imageUrl: string): Promise<string | null> {
    return this.get<string>('images', workspaceId, imageUrl);
  }

  /**
   * Convert blob to base64 string
   */
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}

// Singleton instance
export const cacheService = new CacheService();

