/**
 * v1 handler wiring for templates: published templates for any session user, apply for
 * managers of the target workspace.
 */
import { templatesApplyApiDoc, templatesCollectionApiDoc, templatesItemsApiDoc, TEMPLATE_APPLY_PERMISSIONS } from '@lib/schemas/templates';
import { defineApiHandlers } from '@lib/openapi/apiDoc';
import { ApiError } from '@lib/http/ApiError';
import { getRequestApiKeyPermissions } from '@lib/http/requestAuth';
import * as templates from '@lib/api/controllers/templates';

export const collectionHandler = defineApiHandlers(templatesCollectionApiDoc.operations, {
  GET: ({ query }) => templates.listTemplates(query),
});

export const itemsHandler = defineApiHandlers(templatesItemsApiDoc.operations, {
  GET: ({ params, query }) => templates.getTemplateItems(params.key, query.locale),
});

export const applyHandler = defineApiHandlers(templatesApplyApiDoc.operations, {
  POST: ({ req, workspace, user, params, body }) => {
    const apiKeyPermissions = getRequestApiKeyPermissions(req);
    const missing = Array.isArray(apiKeyPermissions) ? TEMPLATE_APPLY_PERMISSIONS.filter((permission) => !apiKeyPermissions.includes(permission)) : [];
    if (missing.length > 0) throw new ApiError(403, 'FORBIDDEN', `API key does not have required permission ${missing.join(', ')}`);
    return templates.applyTemplateToWorkspace(workspace, user, params.key, body);
  },
});
