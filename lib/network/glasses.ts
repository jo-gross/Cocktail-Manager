import { alertService } from '../alertService';
import { GlassModel } from '../../models/GlassModel';

export function fetchGlasses(
  workspaceId: string | string[] | undefined,
  setGlasses: (glasses: GlassModel[]) => void,
  setGlassesLoading: (loading: boolean) => void,
) {
  if (!workspaceId) return;
  setGlassesLoading(true);
  fetch(`/api/workspaces/${workspaceId}/glasses`)
    .then(async (response) => {
      const body = await response.json();
      if (response.ok) {
        setGlasses(body.data);
      } else {
        console.error('CocktailRecipeForm -> fetchGlasses', response);
        alertService.error(body.message ?? 'Fehler beim Laden der Gläser', response.status, response.statusText);
      }
    })
    .catch((error) => {
      console.error('CocktailRecipeForm -> fetchGlasses', error);
      alertService.error('Fehler beim laden der Gläser');
    })
    .finally(() => {
      setGlassesLoading(false);
    });
}
