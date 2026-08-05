import { apiV1Fetch, apiV1FetchSafe, apiV1Mutate } from './apiV1';
import type { IngredientCreateInput, IngredientDto, IngredientUpdateInput } from '@lib/schemas/ingredients';
import type { DeletionResult } from '@lib/schemas/common';

export function fetchIngredients(
  workspaceId: string | string[] | undefined,
  setIngredients: (ingredients: IngredientDto[]) => void,
  setIngredientsLoading: (loading: boolean) => void,
) {
  if (!workspaceId) return;
  setIngredientsLoading(true);
  apiV1FetchSafe<IngredientDto[]>(`/api/v1/workspaces/${workspaceId}/ingredients`, undefined, 'Fehler beim Laden der Zutaten')
    .then((ingredients) => {
      if (ingredients) setIngredients(ingredients);
    })
    .finally(() => setIngredientsLoading(false));
}

export function getIngredient(workspaceId: string | string[], ingredientId: string): Promise<IngredientDto> {
  return apiV1Fetch<IngredientDto>(`/api/v1/workspaces/${workspaceId}/ingredients/${ingredientId}`);
}

export function createIngredient(workspaceId: string | string[], body: IngredientCreateInput): Promise<IngredientDto> {
  return apiV1Mutate<IngredientDto>(`/api/v1/workspaces/${workspaceId}/ingredients`, 'POST', body);
}

export function updateIngredient(workspaceId: string | string[], ingredientId: string, body: IngredientUpdateInput): Promise<IngredientDto> {
  return apiV1Mutate<IngredientDto>(`/api/v1/workspaces/${workspaceId}/ingredients/${ingredientId}`, 'PUT', body);
}

export function deleteIngredient(workspaceId: string | string[], ingredientId: string): Promise<DeletionResult> {
  return apiV1Mutate<DeletionResult>(`/api/v1/workspaces/${workspaceId}/ingredients/${ingredientId}`, 'DELETE');
}

export function checkIngredientName(workspaceId: string | string[], name: string): Promise<IngredientDto | null> {
  return apiV1Fetch<IngredientDto | null>(`/api/v1/workspaces/${workspaceId}/ingredients/check?name=${encodeURIComponent(name)}`);
}

export function checkIngredientLink(workspaceId: string | string[], link: string): Promise<IngredientDto | null> {
  return apiV1Fetch<IngredientDto | null>(`/api/v1/workspaces/${workspaceId}/ingredients/check?link=${encodeURIComponent(link)}`);
}

export function cloneIngredient(workspaceId: string | string[], ingredientId: string, name: string): Promise<IngredientDto> {
  return apiV1Mutate<IngredientDto>(`/api/v1/workspaces/${workspaceId}/ingredients/${ingredientId}/clone`, 'POST', { name });
}

export function getIngredientReferences(workspaceId: string | string[], ingredientId: string): Promise<{ id: string; name: string }[]> {
  return apiV1Fetch<{ id: string; name: string }[]>(`/api/v1/workspaces/${workspaceId}/ingredients/${ingredientId}/references`);
}
