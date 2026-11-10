import { apiV1Fetch, apiV1Mutate } from './apiV1';
import type { ContentTranslationsDto, ContentTranslationsUpdateInput, ContentTranslationsUpdateResult } from '@lib/schemas/contentTranslations';
import type { ContentTranslationEntityType } from '@lib/translations/contentTranslationFields';

export interface ContentTranslationsFilter {
  locale?: string;
  entity?: ContentTranslationEntityType;
  entityId?: string;
  missingOnly?: boolean;
}

export function getContentTranslations(workspaceId: string | string[], filter: ContentTranslationsFilter = {}): Promise<ContentTranslationsDto> {
  const params = new URLSearchParams();
  if (filter.locale) params.set('locale', filter.locale);
  if (filter.entity) params.set('entity', filter.entity);
  if (filter.entityId) params.set('entityId', filter.entityId);
  if (filter.missingOnly) params.set('missingOnly', 'true');
  const query = params.toString();
  return apiV1Fetch<ContentTranslationsDto>(`/api/v1/workspaces/${workspaceId}/translations/content${query ? `?${query}` : ''}`);
}

export function updateContentTranslations(workspaceId: string | string[], body: ContentTranslationsUpdateInput): Promise<ContentTranslationsUpdateResult> {
  return apiV1Mutate<ContentTranslationsUpdateResult>(`/api/v1/workspaces/${workspaceId}/translations/content`, 'PUT', body);
}
