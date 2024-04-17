import { alertService } from '../alertService';
import { WorkspaceCocktailRecipeStepAction } from '@prisma/client';

export function fetchActions(
  workspaceId: string | string[] | undefined,
  setActions: (actions: WorkspaceCocktailRecipeStepAction[]) => void,
  setActionsLoading: (loading: boolean) => void,
) {
  if (!workspaceId) return;
  setActionsLoading(true);
  fetch(`/api/workspaces/${workspaceId}/actions`)
    .then(async (response) => {
      const body = await response.json();
      if (response.ok) {
        setActions(body.data);
      } else {
        console.error('CocktailRecipeForm -> fetchActions', response);
        alertService.error(body.message ?? 'Fehler beim Laden der Zubereitungsmöglichkeiten', response.status, response.statusText);
      }
    })
    .catch((error) => {
      console.error('CocktailRecipeForm -> fetchActions', error);
      alertService.error('Fehler beim laden der Zubereitungsmöglichkeiten');
    })
    .finally(() => {
      setActionsLoading(false);
    });
}
