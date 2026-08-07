/**
 * v1 handler for PUT /api/v1/users/settings — session user preferences.
 * Hand-wired with withAuthentication (no workspaceId / no API keys).
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import HTTPMethod from 'http-method-enum';
import type { User } from '@generated/prisma/client';
import { withAuthentication } from '@middleware/api/authenticationMiddleware';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { withCors } from '@middleware/api/withCors';
import { sendFail, sendOk } from '@lib/http/responses';
import { UserSettingUpdateSchema } from '@lib/schemas/userSettings';
import { upsertUserSetting } from '@lib/api/controllers/userSettings';

const putUserSetting = withAuthentication(async (req: NextApiRequest, res: NextApiResponse, user: User) => {
  const parsed = UserSettingUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendFail(res, 400, 'VALIDATION_ERROR', 'Invalid user setting payload', parsed.error.issues);
  }

  try {
    const result = await upsertUserSetting(user, parsed.data);
    return sendOk(res, result);
  } catch (error) {
    console.error('putUserSetting', error);
    return sendFail(res, 500, 'INTERNAL_ERROR', 'Failed to update user setting');
  }
});

export const userSettingsHandler = withCors(withHttpMethods({ [HTTPMethod.PUT]: putUserSetting }), [HTTPMethod.PUT]);
