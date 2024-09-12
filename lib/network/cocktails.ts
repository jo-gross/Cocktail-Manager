import { alertService } from '../alertService';
import { CocktailRecipeFull } from '../../models/CocktailRecipeFull';
import { CocktailRecipeFullWithImage } from '../../models/CocktailRecipeFullWithImage';

export function fetchCocktail(
  workspaceId: string | string[] | undefined,
  cocktailId: string,
  setCocktail: (cocktail: CocktailRecipeFull) => void,
  setCocktailLoading: (loading: boolean) => void,
) {
  if (!workspaceId) return;
  setCocktailLoading(true);
  fetch(`/api/workspaces/${workspaceId}/cocktails/${cocktailId}`)
    .then(async (response) => {
      const body = await response.json();
      if (response.ok) {
        setCocktail(body.data);
      } else {
        console.error('fetchCocktail', response);
        alertService.error(body.message ?? 'Fehler beim Laden des Cocktails', response.status, response.statusText);
      }
    })
    .catch((error) => {
      console.error('fetchCocktail', error);
      alertService.error('Fehler beim Laden des Cocktails');
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
) {
  if (!workspaceId) return;
  setCocktailLoading(true);
  fetch(`/api/workspaces/${workspaceId}/cocktails/${cocktailId}?include=image`)
    .then(async (response) => {
      const body = await response.json();
      if (response.ok) {
        setCocktail(body.data);
      } else {
        console.error('fetchCocktail', response);
        alertService.error(body.message ?? 'Fehler beim Laden des Cocktails', response.status, response.statusText);
      }
    })
    .catch((error) => {
      console.error('fetchCocktail', error);
      alertService.error('Fehler beim Laden des Cocktails');
    })
    .finally(() => {
      setCocktailLoading(false);
    });
}
