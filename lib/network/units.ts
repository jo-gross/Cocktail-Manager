import { apiV1FetchSafe, apiV1Mutate } from './apiV1';
import type { UnitDto, UnitConversionDto, UnitCreateInput, UnitConversionCreateInput, UnitConversionUpdateInput } from '@lib/schemas/units';
import type { DeletionResult } from '@lib/schemas/common';

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

export function createUnit(workspaceId: string | string[], body: UnitCreateInput): Promise<UnitDto> {
  return apiV1Mutate<UnitDto>(`/api/v1/workspaces/${workspaceId}/units`, 'POST', body);
}

export function deleteUnit(workspaceId: string | string[], unitId: string): Promise<DeletionResult> {
  return apiV1Mutate<DeletionResult>(`/api/v1/workspaces/${workspaceId}/units/${unitId}`, 'DELETE');
}

export function createUnitConversion(workspaceId: string | string[], body: UnitConversionCreateInput): Promise<UnitConversionDto> {
  return apiV1Mutate<UnitConversionDto>(`/api/v1/workspaces/${workspaceId}/units/conversions`, 'POST', body);
}

export function updateUnitConversion(workspaceId: string | string[], conversionId: string, body: UnitConversionUpdateInput): Promise<UnitConversionDto> {
  return apiV1Mutate<UnitConversionDto>(`/api/v1/workspaces/${workspaceId}/units/conversions/${conversionId}`, 'PUT', body);
}

export function deleteUnitConversion(workspaceId: string | string[], conversionId: string): Promise<DeletionResult> {
  return apiV1Mutate<DeletionResult>(`/api/v1/workspaces/${workspaceId}/units/conversions/${conversionId}`, 'DELETE');
}
