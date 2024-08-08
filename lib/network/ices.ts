import { alertService } from '../alertService';
import { Ice } from '@prisma/client';

export function fetchIce(workspaceId: string | string[] | undefined, setIce: (ice: Ice[]) => void, setIceLoading: (loading: boolean) => void) {
  if (!workspaceId) return;
  setIceLoading(true);
  fetch(`/api/workspaces/${workspaceId}/ice`)
    .then(async (response) => {
      const body = await response.json();
      if (response.ok) {
        setIce(body.data);
      } else {
        console.error('CocktailRecipeForm -> fetchIce', response);
        alertService.error(body.message ?? 'Fehler beim Laden der Eis-Optionen', response.status, response.statusText);
      }
    })
    .catch((error) => {
      console.error('CocktailRecipeForm -> fetchIce', error);
      alertService.error('Fehler beim laden der Eis-Optionen');
    })
    .finally(() => {
      setIceLoading(false);
    });
}
