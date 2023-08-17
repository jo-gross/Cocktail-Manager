import { NextApiRequest, NextApiResponse } from 'next';
import { withAuthentication } from '../../../middleware/authenticationMiddleware';
import { User } from '@prisma/client';

export default withAuthentication(async (req: NextApiRequest, res: NextApiResponse, user: User) => {
  return res.json(user);
});
