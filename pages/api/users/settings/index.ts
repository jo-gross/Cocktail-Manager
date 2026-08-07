import { withAuthentication } from '@middleware/api/authenticationMiddleware';
import HTTPMethod from 'http-method-enum';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { withDeprecation } from '@middleware/api/withDeprecation';
import { NextApiRequest, NextApiResponse } from 'next';
import { User } from '@generated/prisma/client';
import { UserSettingUpdateSchema } from '@lib/schemas/userSettings';
import { upsertUserSetting } from '@lib/api/controllers/userSettings';

const legacyHandler = withHttpMethods({
  [HTTPMethod.PUT]: withAuthentication(async (req: NextApiRequest, res: NextApiResponse, user: User) => {
    const parsed = UserSettingUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid user setting payload', issues: parsed.error.issues });
    }

    const userResult = await upsertUserSetting(user, parsed.data);
    return res.json({ data: userResult });
  }),
});

export default withDeprecation({ successor: '/api/v1/users/settings' }, legacyHandler);
