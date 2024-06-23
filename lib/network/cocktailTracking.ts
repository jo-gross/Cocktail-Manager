import { alertService } from '../alertService';

export async function addCocktailToStatistic({
  workspaceId,
  cocktailId,
  cardId,
  actionSource,
  setSubmitting,
  reload,
}: {
  workspaceId: string;
  cocktailId: string;
  cardId?: string | string[] | undefined;
  actionSource: 'SEARCH_MODAL' | 'CARD' | 'DETAIL_MODAL' | 'QUEUE';
  setSubmitting: (submitting: boolean) => void;
  reload?: () => void;
}) {
  try {
    setSubmitting(true);
    const response = await fetch(`/api/workspaces/${workspaceId}/statistics/cocktails/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cocktailId: cocktailId,
        cocktailCardId: cardId,
        actionSource: actionSource,
      }),
    });
    if (response.ok) {
      reload?.();
      alertService.success('Cocktail als gemacht markiert');
    } else {
      const body = await response.json();
      console.error('addCocktailToStatistic', response);
      alertService.error(body.message ?? 'Fehler beim Hinzufügen des Cocktails zur Statistik', response.status, response.statusText);
    }
  } catch (error) {
    console.error('addCocktailToStatistic', error);
    alertService.error('Es ist ein Fehler aufgetreten');
  } finally {
    setSubmitting(false);
  }
}

export async function addCocktailToQueue({
  workspaceId,
  cocktailId,
  setSubmitting,
  reload,
}: {
  workspaceId: string;
  cocktailId: string;
  setSubmitting: (submitting: boolean) => void;
  reload?: () => void;
}) {
  try {
    setSubmitting(true);
    const response = await fetch(`/api/workspaces/${workspaceId}/queue/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cocktailId: cocktailId,
      }),
    });
    if (response.ok) {
      // alertService.success('Cocktail zur Warteschlange hinzugefügt');
      reload?.();
      alertService.info('Cocktail zur Warteschlange hinzugefügt');
    } else {
      const body = await response.json();
      console.error('addCocktailToQueue', response);
      alertService.error(body.message ?? 'Fehler beim Hinzufügen des Cocktails zur Warteschlange', response.status, response.statusText);
    }
  } catch (error) {
    console.error('addCocktailToQueue', error);
    alertService.error('Es ist ein Fehler aufgetreten');
  } finally {
    setSubmitting(false);
  }
}

export async function removeCocktailFromQueue({
  workspaceId,
  cocktailId,
  setSubmitting,
  reload,
}: {
  workspaceId: string;
  cocktailId: string;
  setSubmitting: (submitting: boolean) => void;
  reload?: () => void;
}) {
  try {
    setSubmitting(true);
    const response = await fetch(`/api/workspaces/${workspaceId}/queue/remove`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cocktailId: cocktailId,
      }),
    });
    if (response.ok) {
      // alertService.success('Cocktail aus der Warteschlange entfernt');
      reload?.();
    } else {
      const body = await response.json();
      console.error('addCocktailToQueue', response);
      alertService.error(body.message ?? 'Fehler beim Entfernen des Cocktails von der Warteschlange', response.status, response.statusText);
    }
  } catch (error) {
    console.error('addCocktailToQueue', error);
    alertService.error('Es ist ein Fehler aufgetreten');
  } finally {
    setSubmitting(false);
  }
}
