import { apiV1FetchSafe } from './apiV1';
import { IngredientModel } from '../../models/IngredientModel';

export function fetchIngredients(
  workspaceId: string | string[] | undefined,
  setIngredients: (ingredients: IngredientModel[]) => void,
  setIngredientsLoading: (loading: boolean) => void,
) {
  if (!workspaceId) return;
  setIngredientsLoading(true);
  apiV1FetchSafe<IngredientModel[]>(`/api/v1/workspaces/${workspaceId}/ingredients`, undefined, 'Fehler beim Laden der Zutaten')
    .then((ingredients) => {
      if (ingredients) setIngredients(ingredients);
    })
    .finally(() => setIngredientsLoading(false));
}
