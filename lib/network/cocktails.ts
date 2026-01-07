import { alertService } from '../alertService';
import { CocktailRecipeFull } from '../../models/CocktailRecipeFull';
import { CocktailRecipeFullWithImage } from '../../models/CocktailRecipeFullWithImage';
import { fetchWithCache, fetchListWithCache } from './fetchWithCache';

export function fetchCocktail(
  workspaceId: string | string[] | undefined,
  cocktailId: string,
  setCocktail: (cocktail: CocktailRecipeFull) => void,
  setCocktailLoading: (loading: boolean) => void,
  onCacheFallback?: () => void,
) {
  if (!workspaceId) return;
  const wsId = Array.isArray(workspaceId) ? workspaceId[0] : workspaceId;

  setCocktailLoading(true);

  fetchWithCache<CocktailRecipeFull>({
    url: `/api/workspaces/${wsId}/cocktails/${cocktailId}`,
    storeName: 'cocktails',
    workspaceId: wsId,
    resourceId: cocktailId,
    onCacheFallback: () => {
      onCacheFallback?.();
    },
    onNetworkError: (error) => {
      console.error('fetchCocktail network error:', error);
    },
  })
    .then(({ data, fromCache, error }) => {
      if (data) {
        setCocktail(data);
        if (fromCache) {
          // Optionally show a subtle indicator that data is from cache
          console.debug('Cocktail loaded from cache:', cocktailId);
        }
      } else if (error) {
        alertService.error('Fehler beim Laden des Cocktails');
      }
    })
    .finally(() => {
      setCocktailLoading(false);
    });
}

export function fetchCocktailWithImage(
  workspaceId: string | string[] | undefined,
  cocktailId: string,
  setCocktail: (cocktail: CocktailRecipeFullWithImage) => void,
  setCocktailLoading: (loading: boolean) => void,
  onCacheFallback?: () => void,
) {
  if (!workspaceId) return;
  const wsId = Array.isArray(workspaceId) ? workspaceId[0] : workspaceId;

  setCocktailLoading(true);

  fetchWithCache<CocktailRecipeFullWithImage>({
    url: `/api/workspaces/${wsId}/cocktails/${cocktailId}?include=image`,
    storeName: 'cocktails',
    workspaceId: wsId,
    resourceId: `${cocktailId}-with-image`,
    onCacheFallback: () => {
      onCacheFallback?.();
    },
    onNetworkError: (error) => {
      console.error('fetchCocktailWithImage network error:', error);
    },
  })
    .then(({ data, fromCache, error }) => {
      if (data) {
        setCocktail(data);
        if (fromCache) {
          console.debug('Cocktail with image loaded from cache:', cocktailId);
        }
      } else if (error) {
        alertService.error('Fehler beim Laden des Cocktails');
      }
    })
    .finally(() => {
      setCocktailLoading(false);
    });
}

/**
 * Fetch all cocktails for a workspace (for search functionality)
 */
export async function fetchCocktails(
  workspaceId: string | string[] | undefined,
  search: string,
  setCocktails: (cocktails: CocktailRecipeFull[]) => void,
  setLoading: (loading: boolean) => void,
  signal?: AbortSignal,
  onCacheFallback?: () => void,
): Promise<void> {
  if (!workspaceId) return;
  const wsId = Array.isArray(workspaceId) ? workspaceId[0] : workspaceId;

  setLoading(true);

  try {
    const { data, fromCache, error } = await fetchListWithCache<CocktailRecipeFull>({
      url: `/api/workspaces/${wsId}/cocktails?${new URLSearchParams({ search })}`,
      storeName: 'cocktails',
      workspaceId: wsId,
      listKey: `search:${search}`,
      fetchOptions: signal ? { signal } : undefined,
      onCacheFallback: () => {
        onCacheFallback?.();
      },
      onNetworkError: (error) => {
        if (error.name !== 'AbortError') {
          console.error('fetchCocktails network error:', error);
        }
      },
    });

    if (data) {
      setCocktails(data);
      if (fromCache) {
        console.debug('Cocktails loaded from cache for search:', search);
      }
    } else if (error && error.name !== 'AbortError') {
      alertService.error('Fehler beim Suchen der Cocktails');
    }
  } catch (error) {
    if ((error as Error).name !== 'AbortError') {
      console.error('fetchCocktails error:', error);
      alertService.error('Es ist ein Fehler aufgetreten');
    }
  } finally {
    setLoading(false);
  }
}

/**
 * Prefetch all cocktails for offline search
 */
export async function prefetchAllCocktails(
  workspaceId: string,
  onProgress?: (loaded: number, total: number) => void,
): Promise<void> {
  try {
    // First, fetch the list of all cocktails
    const response = await fetch(`/api/workspaces/${workspaceId}/cocktails?search=`);
    if (!response.ok) return;

    const body = await response.json();
    const cocktails = body.data as CocktailRecipeFull[];

    if (!cocktails || cocktails.length === 0) return;

    // Cache the full list for empty search
    const { cacheService } = await import('../offline/CacheService');
    await cacheService.set('cocktails', workspaceId, 'search:', cocktails);

    // Cache individual cocktails
    const items = cocktails.map((cocktail) => ({ id: cocktail.id, data: cocktail }));
    await cacheService.setMany('cocktails', workspaceId, items);

    onProgress?.(cocktails.length, cocktails.length);
  } catch (error) {
    console.error('Failed to prefetch cocktails:', error);
  }
}
