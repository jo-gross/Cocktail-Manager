/**
 * Builds default req.query from a ResourceApiDoc basePath for handler invocation.
 */
import type { FlatOperation } from '@lib/openapi/flattenOperations';
import type { ResourceApiDoc } from '@lib/openapi/types';
import type { MockRequestOptions } from './invokeHandler';

const PLACEHOLDER_IDS: Record<string, string> = {
  workspaceId: 'ws_test_001',
  glassId: 'glass_test_001',
  garnishId: 'garnish_test_001',
  ingredientId: 'ingredient_test_001',
  cocktailId: 'cocktail_test_001',
  cardId: 'card_test_001',
  iceId: 'ice_test_001',
  unitId: 'unit_test_001',
  unitConversionId: 'conv_test_001',
  calculationId: 'calc_test_001',
  groupId: 'group_test_001',
  actionId: 'action_test_001',
  keyId: 'key_test_001',
  userId: 'user_test_001',
  code: 'joincode01',
  queueItemId: 'queue_test_001',
  ratingId: 'rating_test_001',
  cocktailStatisticId: 'stat_test_001',
  slideId: 'slide_test_001',
  tagId: 'tag_test_001',
};

export function queryFromBasePath(basePath: string): Record<string, string> {
  const query: Record<string, string> = {};
  const matches = basePath.matchAll(/\{(\w+)\}/g);
  for (const match of matches) {
    const param = match[1]!;
    query[param] = PLACEHOLDER_IDS[param] ?? `${param}_placeholder`;
  }
  return query;
}

export function requestOptionsForOperation(op: FlatOperation, overrides: Partial<MockRequestOptions> = {}): MockRequestOptions {
  return {
    method: op.method,
    query: { ...queryFromBasePath(op.basePath), ...overrides.query },
    body: overrides.body,
    headers: overrides.headers,
    cookies: overrides.cookies,
  };
}

export function requestOptionsForApiDoc(
  apiDoc: ResourceApiDoc,
  method: keyof ResourceApiDoc['operations'],
  overrides: Partial<MockRequestOptions> = {},
): MockRequestOptions {
  return {
    method: method as string,
    query: { ...queryFromBasePath(apiDoc.basePath), ...overrides.query },
    body: overrides.body,
    headers: overrides.headers,
    cookies: overrides.cookies,
  };
}
