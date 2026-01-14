import { alertService } from '../alertService';
import { CocktailCardFull } from '../../models/CocktailCardFull';
import { fetchListWithCache, fetchWithCache, prefetchImage } from './fetchWithCache';

/**
 * Fetch all cards for a workspace
 */
export async function fetchCards(
  workspaceId: string | string[] | undefined,
  setCards: (cards: CocktailCardFull[]) => void,
  setLoading: (loading: boolean) => void,
  onCacheFallback?: () => void,
): Promise<void> {
  if (!workspaceId) return;
  const wsId = Array.isArray(workspaceId) ? workspaceId[0] : workspaceId;

  setLoading(true);

  try {
    const { data, fromCache, error } = await fetchListWithCache<CocktailCardFull>({
      url: `/api/workspaces/${wsId}/cards`,
      storeName: 'cards',
      workspaceId: wsId,
      listKey: 'all',
      onCacheFallback: () => {
        onCacheFallback?.();
      },
      onNetworkError: (error) => {
        console.error('fetchCards network error:', error);
      },
    });

    if (data) {
      setCards(data);
      if (fromCache) {
        console.debug('Cards loaded from cache');
      }
    } else if (error) {
      alertService.error('Fehler beim Laden der Karten');
    }
  } catch (error) {
    console.error('fetchCards error:', error);
    alertService.error('Fehler beim Laden der Karten');
  } finally {
    setLoading(false);
  }
}

/**
 * Fetch a single card with all its groups and items
 */
export async function fetchCard(
  workspaceId: string | string[] | undefined,
  cardId: string,
  setCard: (card: CocktailCardFull) => void,
  setLoading: (loading: boolean) => void,
  onCacheFallback?: () => void,
): Promise<void> {
  if (!workspaceId) return;
  const wsId = Array.isArray(workspaceId) ? workspaceId[0] : workspaceId;

  setLoading(true);

  try {
    const { data, fromCache, error } = await fetchWithCache<CocktailCardFull>({
      url: `/api/workspaces/${wsId}/cards/${cardId}`,
      storeName: 'cards',
      workspaceId: wsId,
      resourceId: cardId,
      onCacheFallback: () => {
        onCacheFallback?.();
      },
      onNetworkError: (error) => {
        console.error('fetchCard network error:', error);
      },
    });

    if (data) {
      setCard(data);
      if (fromCache) {
        console.debug('Card loaded from cache:', cardId);
      }
    } else if (error) {
      alertService.error('Fehler beim Laden der Karte');
    }
  } catch (error) {
    console.error('fetchCard error:', error);
    alertService.error('Fehler beim Laden der Karte');
  } finally {
    setLoading(false);
  }
}

/**
 * Prefetch all data for a card (cocktails, images, etc.) for offline use
 */
export async function prefetchCardData(workspaceId: string, card: CocktailCardFull, onProgress?: (current: number, total: number) => void): Promise<void> {
  const { cacheService } = await import('../offline/CacheService');

  // Collect all cocktail IDs from the card
  const cocktailIds: string[] = [];
  const imageUrls: string[] = [];

  card.groups?.forEach((group) => {
    group.items?.forEach((item) => {
      if (item.cocktailId) {
        cocktailIds.push(item.cocktailId);
      }
    });
  });

  const total = cocktailIds.length;
  let current = 0;

  // Fetch and cache each cocktail
  for (const cocktailId of cocktailIds) {
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/cocktails/${cocktailId}`);
      if (response.ok) {
        const body = await response.json();
        await cacheService.set('cocktails', workspaceId, cocktailId, body.data);

        // Cache cocktail image if it has one
        if (body.data._count?.CocktailRecipeImage > 0) {
          const imageUrl = `/api/workspaces/${workspaceId}/cocktails/${cocktailId}/image`;
          imageUrls.push(imageUrl);
        }

        // Cache glass image if it has one
        if (body.data.glass?._count?.GlassImage > 0) {
          const glassImageUrl = `/api/workspaces/${workspaceId}/glasses/${body.data.glass.id}/image`;
          imageUrls.push(glassImageUrl);
        }

        // Cache garnish images
        body.data.garnishes?.forEach((g: { garnish?: { id: string; _count?: { GarnishImage: number } } }) => {
          if (g.garnish && g.garnish._count && g.garnish._count.GarnishImage > 0) {
            const garnishImageUrl = `/api/workspaces/${workspaceId}/garnishes/${g.garnish.id}/image`;
            imageUrls.push(garnishImageUrl);
          }
        });
      }
    } catch (error) {
      console.error(`Failed to prefetch cocktail ${cocktailId}:`, error);
    }

    current++;
    onProgress?.(current, total);
  }

  // Cache images in parallel
  await Promise.allSettled(imageUrls.map((url) => prefetchImage(workspaceId, url)));
}
