/**
 * v1 handler wiring for guest information (derived cocktail info, overview, bulk edit).
 */
import { Permission } from '@generated/prisma/client';
import { cocktailGuestInfoApiDoc, guestInfoBulkApiDoc, guestInfoOverviewApiDoc } from '@lib/schemas/guestInfo';
import { defineApiHandlers } from '@lib/openapi/apiDoc';
import { ApiError } from '@lib/http/ApiError';
import { getRequestApiKeyPermissions } from '@lib/http/requestAuth';
import * as guestInfo from '@lib/api/controllers/guestInfo';

export const cocktailGuestInfoHandler = defineApiHandlers(cocktailGuestInfoApiDoc.operations, {
  GET: ({ workspace, params }) => guestInfo.getCocktailGuestInfo(workspace, params.cocktailId),
});

export const overviewHandler = defineApiHandlers(guestInfoOverviewApiDoc.operations, {
  GET: ({ workspace }) => guestInfo.getGuestInfoOverview(workspace),
});

export const bulkHandler = defineApiHandlers(guestInfoBulkApiDoc.operations, {
  PUT: ({ req, workspace, user, body }) => {
    // The route requires INGREDIENTS_UPDATE; garnish edits additionally need GARNISHES_UPDATE for API keys.
    const apiKeyPermissions = getRequestApiKeyPermissions(req);
    if (body.garnishes?.length && apiKeyPermissions && apiKeyPermissions !== 'all' && !apiKeyPermissions.includes(Permission.GARNISHES_UPDATE)) {
      throw new ApiError(403, 'FORBIDDEN', 'API key does not have required permission GARNISHES_UPDATE');
    }
    return guestInfo.bulkUpdateGuestInfo(workspace, user, body);
  },
});
