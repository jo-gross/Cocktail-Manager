import { apiV1Fetch, apiV1Mutate } from '@lib/network/apiV1';
import type { TemplateApplyInput, TemplateApplyResultDto, TemplateItemsDto, TemplateSummaryDto } from '@lib/schemas/templates';

export type { TemplateApplyResultDto, TemplateItemsDto, TemplateSummaryDto };

export function listCatalogTemplates(locale: string): Promise<TemplateSummaryDto[]> {
  return apiV1Fetch<TemplateSummaryDto[]>(`/api/v1/templates?${new URLSearchParams({ kind: 'CATALOG', locale })}`);
}

export function fetchTemplateItems(key: string, locale: string): Promise<TemplateItemsDto> {
  return apiV1Fetch<TemplateItemsDto>(`/api/v1/templates/${encodeURIComponent(key)}/items?${new URLSearchParams({ locale })}`);
}

export function applyTemplate(workspaceId: string, key: string, body: TemplateApplyInput): Promise<TemplateApplyResultDto> {
  return apiV1Mutate<TemplateApplyResultDto>(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/templates/${encodeURIComponent(key)}/apply`, 'POST', body);
}
