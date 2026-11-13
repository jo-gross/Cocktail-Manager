import { NextApiRequest, NextApiResponse } from 'next';
import HTTPMethod from 'http-method-enum';
import { withHttpMethods } from '@middleware/api/handleMethods';

async function getWorkspaceCreationConfig(req: NextApiRequest, res: NextApiResponse) {
  return res.json({
    data: {
      disabled: process.env.DISABLE_WORKSPACE_CREATION === 'true',
      message: process.env.WORKSPACE_CREATION_DISABLED_MESSAGE || null,
    },
  });
}

export default withHttpMethods({ [HTTPMethod.GET]: getWorkspaceCreationConfig });
