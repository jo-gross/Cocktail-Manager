import { apiV1Fetch, apiV1Mutate } from '@lib/network/apiV1';
import type { BusinessType } from '@lib/onboarding/setupWizard';
import type {
  TemplateApplyInput,
  TemplateApplyResultDto as TemplateApplyResultSchemaDto,
  TemplateItemsDto,
  TemplateSummaryDto as TemplateSummarySchemaDto,
} from '@lib/schemas/templates';

/** Guest menus in the counts; optional because servers before guest menu templates do not report them. */
type WithGuestMenus<T> = T & { guestMenus?: number };

export type TemplateSummaryDto = Omit<TemplateSummarySchemaDto, 'counts'> & { counts: WithGuestMenus<TemplateSummarySchemaDto['counts']> };

export type TemplateApplyResultDto = Omit<TemplateApplyResultSchemaDto, 'created' | 'linked' | 'skipped'> & {
  created: WithGuestMenus<TemplateApplyResultSchemaDto['created']>;
  linked: WithGuestMenus<TemplateApplyResultSchemaDto['linked']>;
  skipped: WithGuestMenus<TemplateApplyResultSchemaDto['skipped']>;
};

export type { TemplateItemsDto };

/** `businessType` (setup wizard) picks the design of the template's guest menus; servers that do not know it ignore it. */
export type TemplateApplyBody = TemplateApplyInput & { businessType?: BusinessType };

export function listCatalogTemplates(locale: string): Promise<TemplateSummaryDto[]> {
  return apiV1Fetch<TemplateSummaryDto[]>(`/api/v1/templates?${new URLSearchParams({ kind: 'CATALOG', locale })}`);
}

export function fetchTemplateItems(key: string, locale: string): Promise<TemplateItemsDto> {
  return apiV1Fetch<TemplateItemsDto>(`/api/v1/templates/${encodeURIComponent(key)}/items?${new URLSearchParams({ locale })}`);
}

export function applyTemplate(workspaceId: string, key: string, body: TemplateApplyBody): Promise<TemplateApplyResultDto> {
  return apiV1Mutate<TemplateApplyResultDto>(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/templates/${encodeURIComponent(key)}/apply`, 'POST', body);
}
