import { alertService } from '../alertService';
import { IngredientModel } from '../../models/IngredientModel';

export function fetchIngredients(
  workspaceId: string | string[] | undefined,
  setIngredients: (ingredients: IngredientModel[]) => void,
  setIngredientsLoading: (loading: boolean) => void,
) {
  if (!workspaceId) return;

  setIngredientsLoading(true);
  fetch(`/api/workspaces/${workspaceId}/ingredients`)
    .then(async (response) => {
      const body = await response.json();
      if (response.ok) {
        setIngredients(body.data);
      } else {
        console.error('CocktailRecipeForm -> fetchIngredients', response);
        alertService.error(body.message ?? 'Fehler beim Laden der Zutaten', response.status, response.statusText);
      }
    })
    .catch((error) => {
      console.error('CocktailRecipeForm -> fetchIngredients', error);
      alertService.error('Fehler beim Laden der Zutaten');
    })
    .finally(() => {
      setIngredientsLoading(false);
    });
}
