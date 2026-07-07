import { apiV1FetchSafe } from './apiV1';
import type { UnitDto, UnitConversionDto } from '@lib/schemas/units';

export function fetchUnits(workspaceId: string | string[] | undefined, setUnits: (units: UnitDto[]) => void, setUnitsLoading: (loading: boolean) => void) {
  if (workspaceId == undefined) return;
  setUnitsLoading(true);
  apiV1FetchSafe<UnitDto[]>(`/api/v1/workspaces/${workspaceId}/units`, undefined, 'Fehler beim Laden der Einheiten')
    .then((units) => {
      if (units) setUnits(units);
    })
    .finally(() => setUnitsLoading(false));
}

export const fetchUnitConversions = (
  workspaceId: string | string[] | undefined,
  setUnitConversionsLoading: (loading: boolean) => void,
  setUnitConversions: (conversions: UnitConversionDto[]) => void,
) => {
  if (workspaceId == undefined) return;
  setUnitConversionsLoading(true);
  apiV1FetchSafe<UnitConversionDto[]>(`/api/v1/workspaces/${workspaceId}/units/conversions`, undefined, 'Fehler beim Laden der Einheiten')
    .then((conversions) => {
      if (conversions) setUnitConversions(conversions);
    })
    .finally(() => setUnitConversionsLoading(false));
};
