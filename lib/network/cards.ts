import { alertService } from '../alertService';
import { fetchListWithCache, fetchWithCache, prefetchImage } from './fetchWithCache';
import type { CardDto, CardSummaryDto } from '@lib/schemas/cards';
import type { CocktailDto } from '@lib/schemas/cocktails';

/**
 * Fetch all cards for a workspace
 */
export async function fetchCards(
  workspaceId: string | string[] | undefined,
  setCards: (cards: CardSummaryDto[]) => void,
  setLoading: (loading: boolean) => void,
  onCacheFallback?: () => void,
): Promise<void> {
  if (!workspaceId) return;
  const wsId = Array.isArray(workspaceId) ? workspaceId[0] : workspaceId;

  setLoading(true);

  try {
    const { data, fromCache, error } = await fetchListWithCache<CardSummaryDto>({
      url: `/api/v1/workspaces/${wsId}/cards`,
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
  setCard: (card: CardDto) => void,
  setLoading: (loading: boolean) => void,
  onCacheFallback?: () => void,
): Promise<void> {
  if (!workspaceId) return;
  const wsId = Array.isArray(workspaceId) ? workspaceId[0] : workspaceId;

  setLoading(true);

  try {
    const { data, fromCache, error } = await fetchWithCache<CardDto>({
      url: `/api/v1/workspaces/${wsId}/cards/${cardId}`,
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
export async function prefetchCardData(workspaceId: string, card: CardDto, onProgress?: (current: number, total: number) => void): Promise<void> {
  const { cacheService } = await import('../offline/CacheService');

  const cocktailIds: string[] = [];
  const imageUrls: string[] = [];

  card.groups?.forEach((group) => {
    group.items?.forEach((item) => {
      if (item.cocktail?.id) {
        cocktailIds.push(item.cocktail.id);
      }
    });
  });

  const total = cocktailIds.length;
  let current = 0;

  for (const cocktailId of cocktailIds) {
    try {
      const response = await fetch(`/api/v1/workspaces/${workspaceId}/cocktails/${cocktailId}`);
      if (response.ok) {
        const body = await response.json();
        const cocktail = body.data as CocktailDto;
        await cacheService.set('cocktails', workspaceId, `${cocktailId}-full`, cocktail);

        if (cocktail.hasImage && cocktail.imageUrl) {
          imageUrls.push(cocktail.imageUrl);
        }

        if (cocktail.glass?.hasImage) {
          imageUrls.push(`/api/v1/workspaces/${workspaceId}/glasses/${cocktail.glass.id}/image`);
        }

        cocktail.garnishes?.forEach((g) => {
          if (g.garnish?.hasImage) {
            imageUrls.push(`/api/v1/workspaces/${workspaceId}/garnishes/${g.garnish.id}/image`);
          }
        });
      }
    } catch (error) {
      console.error(`Failed to prefetch cocktail ${cocktailId}:`, error);
    }

    current++;
    onProgress?.(current, total);
  }

  await Promise.allSettled(imageUrls.map((url) => prefetchImage(workspaceId, url)));
}
