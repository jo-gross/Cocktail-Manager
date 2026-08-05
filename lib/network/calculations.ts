import { apiV1Fetch, apiV1FetchSafe, apiV1Mutate } from './apiV1';
import type {
  CalculationDto,
  CalculationSummaryDto,
  CalculationGroupDto,
  CalculationCreateInput,
  CalculationUpdateInput,
  CalculationGroupCreateInput,
  CalculationGroupUpdateInput,
  CalculationGroupAssignInput,
} from '@lib/schemas/calculations';
import type { DeletionResult } from '@lib/schemas/common';

export function listCalculations(workspaceId: string | string[]): Promise<CalculationSummaryDto[]> {
  return apiV1Fetch<CalculationSummaryDto[]>(`/api/v1/workspaces/${workspaceId}/calculations`);
}

export function listCalculationGroups(workspaceId: string | string[]): Promise<CalculationGroupDto[]> {
  return apiV1Fetch<CalculationGroupDto[]>(`/api/v1/workspaces/${workspaceId}/calculations/groups`);
}

export function fetchCalculationsAndGroupsSafe(
  workspaceId: string | string[] | undefined,
  setCalculations: (calculations: CalculationSummaryDto[]) => void,
  setGroups: (groups: CalculationGroupDto[]) => void,
  setLoading: (loading: boolean) => void,
) {
  if (workspaceId == undefined) return;
  setLoading(true);
  Promise.all([
    apiV1FetchSafe<CalculationSummaryDto[]>(`/api/v1/workspaces/${workspaceId}/calculations`, undefined, 'Fehler beim Laden der Kalkulationen'),
    apiV1FetchSafe<CalculationGroupDto[]>(`/api/v1/workspaces/${workspaceId}/calculations/groups`, undefined, 'Fehler beim Laden der Gruppen'),
  ])
    .then(([calculations, groups]) => {
      if (calculations) setCalculations(calculations);
      if (groups) setGroups(groups);
    })
    .finally(() => setLoading(false));
}

export function getCalculation(workspaceId: string | string[], calculationId: string): Promise<CalculationDto> {
  return apiV1Fetch<CalculationDto>(`/api/v1/workspaces/${workspaceId}/calculations/${calculationId}`);
}

export function createCalculation(workspaceId: string | string[], body: CalculationCreateInput): Promise<CalculationDto> {
  return apiV1Mutate<CalculationDto>(`/api/v1/workspaces/${workspaceId}/calculations`, 'POST', body);
}

export function updateCalculation(workspaceId: string | string[], calculationId: string, body: CalculationUpdateInput): Promise<CalculationDto> {
  return apiV1Mutate<CalculationDto>(`/api/v1/workspaces/${workspaceId}/calculations/${calculationId}`, 'PUT', body);
}

export function deleteCalculation(workspaceId: string | string[], calculationId: string): Promise<DeletionResult> {
  return apiV1Mutate<DeletionResult>(`/api/v1/workspaces/${workspaceId}/calculations/${calculationId}`, 'DELETE');
}

export function createCalculationGroup(workspaceId: string | string[], body: CalculationGroupCreateInput): Promise<CalculationGroupDto> {
  return apiV1Mutate<CalculationGroupDto>(`/api/v1/workspaces/${workspaceId}/calculations/groups`, 'POST', body);
}

export function updateCalculationGroup(workspaceId: string | string[], groupId: string, body: CalculationGroupUpdateInput): Promise<CalculationGroupDto> {
  return apiV1Mutate<CalculationGroupDto>(`/api/v1/workspaces/${workspaceId}/calculations/groups/${groupId}`, 'PUT', body);
}

export function deleteCalculationGroup(workspaceId: string | string[], groupId: string): Promise<DeletionResult> {
  return apiV1Mutate<DeletionResult>(`/api/v1/workspaces/${workspaceId}/calculations/groups/${groupId}`, 'DELETE');
}

export function assignCalculationsToGroup(workspaceId: string | string[], body: CalculationGroupAssignInput): Promise<DeletionResult | { ok: boolean }> {
  return apiV1Mutate(`/api/v1/workspaces/${workspaceId}/calculations/groups/assign`, 'POST', body);
}
