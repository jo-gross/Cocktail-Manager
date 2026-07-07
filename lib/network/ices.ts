import { apiV1FetchSafe } from './apiV1';
import type { IceDto } from '@lib/schemas/ices';

export function fetchIce(workspaceId: string | string[] | undefined, setIce: (ice: IceDto[]) => void, setIceLoading: (loading: boolean) => void) {
  if (!workspaceId) return;
  setIceLoading(true);
  apiV1FetchSafe<IceDto[]>(`/api/v1/workspaces/${workspaceId}/ice`, undefined, 'Fehler beim Laden der Eis-Optionen')
    .then((ice) => {
      if (ice) setIce(ice);
    })
    .finally(() => setIceLoading(false));
}
