import { apiV1FetchSafe } from './apiV1';
import { GarnishModel } from '../../models/GarnishModel';

export function fetchGarnishes(
  workspaceId: string | string[] | undefined,
  setGarnishes: (garnishes: GarnishModel[]) => void,
  setGarnishesLoading: (loading: boolean) => void,
) {
  if (!workspaceId) return;
  setGarnishesLoading(true);
  apiV1FetchSafe<GarnishModel[]>(`/api/v1/workspaces/${workspaceId}/garnishes`, undefined, 'Fehler beim Laden der Garnituren')
    .then((garnishes) => {
      if (garnishes) setGarnishes(garnishes);
    })
    .finally(() => setGarnishesLoading(false));
}
