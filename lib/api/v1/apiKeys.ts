/**
 * v1 handler wiring for workspace API-key management: validated, typed ctx → shared controllers.
 * Create/delete are `sessionOnly` (see the apiDoc), so `user` is a real logged-in user.
 */
import { ApiError } from '@lib/http/ApiError';
import { apiKeysCollectionApiDoc, apiKeysItemApiDoc } from '@lib/schemas/apiKeys';
import { defineApiHandlers } from '@lib/openapi/apiDoc';
import * as apiKeys from '@lib/api/controllers/apiKeys';

export const collectionHandler = defineApiHandlers(apiKeysCollectionApiDoc.operations, {
  GET: ({ workspace }) => apiKeys.listApiKeys(workspace),
  POST: ({ workspace, user, body }) => apiKeys.createApiKey(workspace, user, body),
});

export const itemHandler = defineApiHandlers(apiKeysItemApiDoc.operations, {
  GET: async ({ workspace, params }) => {
    const key = await apiKeys.getApiKey(workspace, params.keyId);
    if (!key) throw new ApiError(404, 'NOT_FOUND', 'API key not found');
    return key;
  },
  DELETE: ({ workspace, params }) => apiKeys.deleteApiKey(workspace, params.keyId),
});
