/**
 * v1 handler wiring for guest information (derived cocktail info, overview, bulk edit).
 */
import { Permission } from '@generated/prisma/client';
import { cocktailGuestInfoApiDoc, guestInfoBulkApiDoc, guestInfoOverviewApiDoc } from '@lib/schemas/guestInfo';
import { defineApiHandlers } from '@lib/openapi/apiDoc';
import { ApiError } from '@lib/http/ApiError';
import { hasPermission } from '@lib/permissions/apiKeyPermissions';
import { authenticateApiKey } from '@middleware/api/jwtApiKeyMiddleware';
import * as guestInfo from '@lib/api/controllers/guestInfo';

export const cocktailGuestInfoHandler = defineApiHandlers(cocktailGuestInfoApiDoc.operations, {
  GET: ({ workspace, params }) => guestInfo.getCocktailGuestInfo(workspace, params.cocktailId),
});

export const overviewHandler = defineApiHandlers(guestInfoOverviewApiDoc.operations, {
  GET: ({ workspace }) => guestInfo.getGuestInfoOverview(workspace),
});

export const bulkHandler = defineApiHandlers(guestInfoBulkApiDoc.operations, {
  PUT: async ({ req, workspace, user, body }) => {
    // The route requires INGREDIENTS_UPDATE; garnish edits additionally need GARNISHES_UPDATE for API keys.
    if (body.garnishes && body.garnishes.length > 0) {
      const apiKey = await authenticateApiKey(req);
      if (apiKey && !hasPermission(apiKey.permissions, Permission.GARNISHES_UPDATE)) {
        throw new ApiError(403, 'FORBIDDEN', 'API key does not have required permission GARNISHES_UPDATE');
      }
    }
    return guestInfo.bulkUpdateGuestInfo(workspace, user, body);
  },
});
