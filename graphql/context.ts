import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from 'next-auth/react';

export async function createContext({ req, res }: { req: NextApiRequest; res: NextApiResponse }) {
  const session = await getSession({ req });

  // if the user is not logged in, return an empty object

  if (!session || typeof session === 'undefined') return {};

  const { user } = session;

  return {
    user,
  };
}
