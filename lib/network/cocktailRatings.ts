import { alertService } from '../alertService';
import { CocktailRating } from '@generated/prisma/client';

export function fetchCocktailRatings(
  workspaceId: string | string[] | undefined,
  cocktailId: string,
  setCocktailRatings: (ratings: CocktailRating[]) => void,
  setCocktailRatingLoading: (loading: boolean) => void,
  setCocktailRatingError: (hasError: boolean) => void,
) {
  if (!workspaceId) return;
  setCocktailRatingLoading(true);
  fetch(`/api/workspaces/${workspaceId}/cocktails/${cocktailId}/ratings`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })
    .then(async (response) => {
      if (response.ok) {
        const body = await response.json();
        setCocktailRatings(body.data);
        setCocktailRatingError(false);
      } else {
        const body = await response.json();
        alertService.error(body.message ?? 'Fehler beim Laden der Cocktail Bewertungen', response.status, response.statusText);
        setCocktailRatings([]);
        setCocktailRatingError(true);
      }
    })
    .catch((error) => {
      console.error('fetchCocktailRatings', error);
      alertService.error('Es ist ein Fehler aufgetreten');
      setCocktailRatingError(true);
    })
    .finally(() => {
      setCocktailRatingLoading(false);
    });
}
