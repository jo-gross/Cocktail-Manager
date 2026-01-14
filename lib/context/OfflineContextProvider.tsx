import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { cacheService, CacheStoreName } from '../offline/CacheService';

interface OfflineContextProps {
  /** Whether the app is currently online */
  isOnline: boolean;
  /** Whether we're using cached data (offline mode active) */
  isOfflineMode: boolean;
  /** Manually set offline mode (useful for testing or when network is unreliable) */
  setOfflineMode: (offline: boolean) => void;

  // Cache helper functions
  cacheData: <T>(storeName: CacheStoreName, workspaceId: string, resourceId: string, data: T) => Promise<void>;
  getCachedData: <T>(storeName: CacheStoreName, workspaceId: string, resourceId: string) => Promise<T | null>;
  cacheManyData: <T>(storeName: CacheStoreName, workspaceId: string, items: { id: string; data: T }[]) => Promise<void>;
  getAllCachedData: <T>(storeName: CacheStoreName, workspaceId: string) => Promise<T[]>;
  cacheImage: (workspaceId: string, imageUrl: string) => Promise<void>;
  getCachedImage: (workspaceId: string, imageUrl: string) => Promise<string | null>;
  clearCache: (workspaceId?: string) => Promise<void>;
}

export const OfflineContext = createContext<OfflineContextProps>({
  isOnline: true,
  isOfflineMode: false,
  setOfflineMode: () => {},
  cacheData: async () => {},
  getCachedData: async () => null,
  cacheManyData: async () => {},
  getAllCachedData: async () => [],
  cacheImage: async () => {},
  getCachedImage: async () => null,
  clearCache: async () => {},
});

interface OfflineContextProviderProps {
  children: ReactNode;
}

export function OfflineContextProvider({ children }: OfflineContextProviderProps) {
  const [isOnline, setIsOnline] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  // Initialize online status on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
    }
  }, []);

  // Listen for online/offline events
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsOnline(true);
      // Reset offline mode when we come back online
      setIsOfflineMode(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIsOfflineMode(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const setOfflineMode = useCallback((offline: boolean) => {
    setIsOfflineMode(offline);
  }, []);

  // Cache helper functions
  const cacheData = useCallback(async <T,>(storeName: CacheStoreName, workspaceId: string, resourceId: string, data: T) => {
    await cacheService.set(storeName, workspaceId, resourceId, data);
  }, []);

  const getCachedData = useCallback(async <T,>(storeName: CacheStoreName, workspaceId: string, resourceId: string): Promise<T | null> => {
    return cacheService.get<T>(storeName, workspaceId, resourceId);
  }, []);

  const cacheManyData = useCallback(async <T,>(storeName: CacheStoreName, workspaceId: string, items: { id: string; data: T }[]) => {
    await cacheService.setMany(storeName, workspaceId, items);
  }, []);

  const getAllCachedData = useCallback(async <T,>(storeName: CacheStoreName, workspaceId: string): Promise<T[]> => {
    return cacheService.getAllForWorkspace<T>(storeName, workspaceId);
  }, []);

  const cacheImageFn = useCallback(async (workspaceId: string, imageUrl: string) => {
    await cacheService.cacheImage(workspaceId, imageUrl);
  }, []);

  const getCachedImage = useCallback(async (workspaceId: string, imageUrl: string): Promise<string | null> => {
    return cacheService.getCachedImage(workspaceId, imageUrl);
  }, []);

  const clearCache = useCallback(async (workspaceId?: string) => {
    if (workspaceId) {
      await cacheService.clearWorkspace(workspaceId);
    } else {
      await cacheService.clearAll();
    }
  }, []);

  const value: OfflineContextProps = {
    isOnline,
    isOfflineMode,
    setOfflineMode,
    cacheData,
    getCachedData,
    cacheManyData,
    getAllCachedData,
    cacheImage: cacheImageFn,
    getCachedImage,
    clearCache,
  };

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

/**
 * Hook to access the offline context
 */
export function useOffline() {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within an OfflineContextProvider');
  }
  return context;
}
