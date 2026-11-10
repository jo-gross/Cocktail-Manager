import { apiV1Fetch, apiV1Mutate } from './apiV1';
import type { DeletionResult } from '@lib/schemas/common';
import type {
  TagCategoriesBulkUpdateInput,
  TagCategoryCreateInput,
  TagCategoryDto,
  TagCategoryUpdateInput,
  TagDefinitionDto,
  TagDefinitionsBulkUpdateInput,
} from '@lib/schemas/tags';

export function getTagCategories(workspaceId: string | string[]): Promise<TagCategoryDto[]> {
  return apiV1Fetch<TagCategoryDto[]>(`/api/v1/workspaces/${workspaceId}/tags/categories`);
}

export function createTagCategory(workspaceId: string | string[], body: TagCategoryCreateInput): Promise<TagCategoryDto> {
  return apiV1Mutate<TagCategoryDto>(`/api/v1/workspaces/${workspaceId}/tags/categories`, 'POST', body);
}

export function upsertTagCategories(workspaceId: string | string[], body: TagCategoriesBulkUpdateInput): Promise<TagCategoryDto[]> {
  return apiV1Mutate<TagCategoryDto[]>(`/api/v1/workspaces/${workspaceId}/tags/categories`, 'PUT', body);
}

export function updateTagCategory(workspaceId: string | string[], categoryId: string, body: TagCategoryUpdateInput): Promise<TagCategoryDto> {
  return apiV1Mutate<TagCategoryDto>(`/api/v1/workspaces/${workspaceId}/tags/categories/${categoryId}`, 'PUT', body);
}

export function deleteTagCategory(workspaceId: string | string[], categoryId: string): Promise<DeletionResult> {
  return apiV1Mutate<DeletionResult>(`/api/v1/workspaces/${workspaceId}/tags/categories/${categoryId}`, 'DELETE');
}

export function createDefaultTagCategories(workspaceId: string | string[]): Promise<TagCategoryDto[]> {
  return apiV1Mutate<TagCategoryDto[]>(`/api/v1/workspaces/${workspaceId}/tags/categories/defaults`, 'POST');
}

export function getTagDefinitions(workspaceId: string | string[]): Promise<TagDefinitionDto[]> {
  return apiV1Fetch<TagDefinitionDto[]>(`/api/v1/workspaces/${workspaceId}/tags/definitions`);
}

export function upsertTagDefinitions(workspaceId: string | string[], body: TagDefinitionsBulkUpdateInput): Promise<TagDefinitionDto[]> {
  return apiV1Mutate<TagDefinitionDto[]>(`/api/v1/workspaces/${workspaceId}/tags/definitions`, 'PUT', body);
}
