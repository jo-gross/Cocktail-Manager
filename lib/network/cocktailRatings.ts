import { apiV1FetchSafe, apiV1Mutate } from './apiV1';
import type { RatingDto, RatingCreateInput } from '@lib/schemas/ratings';

export function fetchCocktailRatings(
  workspaceId: string | string[] | undefined,
  cocktailId: string,
  setCocktailRatings: (ratings: RatingDto[]) => void,
  setCocktailRatingLoading: (loading: boolean) => void,
  setCocktailRatingError: (hasError: boolean) => void,
) {
  if (!workspaceId) return;
  setCocktailRatingLoading(true);
  apiV1FetchSafe<RatingDto[]>(
    `/api/v1/workspaces/${workspaceId}/cocktails/${cocktailId}/ratings`,
    {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    },
    'Fehler beim Laden der Cocktail Bewertungen',
  )
    .then((ratings) => {
      if (ratings) {
        setCocktailRatings(ratings);
        setCocktailRatingError(false);
      } else {
        setCocktailRatings([]);
        setCocktailRatingError(true);
      }
    })
    .finally(() => {
      setCocktailRatingLoading(false);
    });
}

export function createCocktailRating(workspaceId: string | string[], cocktailId: string, body: RatingCreateInput): Promise<RatingDto> {
  return apiV1Mutate<RatingDto>(`/api/v1/workspaces/${workspaceId}/cocktails/${cocktailId}/ratings`, 'POST', body);
}
