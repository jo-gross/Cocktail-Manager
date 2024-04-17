import { alertService } from '../alertService';
import { GarnishModel } from '../../models/GarnishModel';

export function fetchGarnishes(
  workspaceId: string | string[] | undefined,
  setGarnishes: (garnishes: GarnishModel[]) => void,
  setGarnishesLoading: (loading: boolean) => void,
) {
  if (!workspaceId) return;
  setGarnishesLoading(true);
  fetch(`/api/workspaces/${workspaceId}/garnishes`)
    .then(async (response) => {
      const body = await response.json();
      if (response.ok) {
        setGarnishes(body.data);
      } else {
        console.error('CocktailRecipeForm -> fetchGarnishes', response);
        alertService.error(body.message ?? 'Fehler beim Laden der Garnituren', response.status, response.statusText);
      }
    })
    .catch((error) => {
      console.error('CocktailRecipeForm -> fetchGarnishes', error);
      alertService.error('Fehler beim Laden der Garnituren');
    })
    .finally(() => {
      setGarnishesLoading(false);
    });
}
