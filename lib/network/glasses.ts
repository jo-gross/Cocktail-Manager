import { apiV1FetchSafe } from './apiV1';
import { GlassModel } from '../../models/GlassModel';

export function fetchGlasses(
  workspaceId: string | string[] | undefined,
  setGlasses: (glasses: GlassModel[]) => void,
  setGlassesLoading: (loading: boolean) => void,
) {
  if (!workspaceId) return;
  setGlassesLoading(true);
  apiV1FetchSafe<GlassModel[]>(`/api/v1/workspaces/${workspaceId}/glasses`, undefined, 'Fehler beim Laden der Gläser')
    .then((glasses) => {
      if (glasses) setGlasses(glasses);
    })
    .finally(() => setGlassesLoading(false));
}
