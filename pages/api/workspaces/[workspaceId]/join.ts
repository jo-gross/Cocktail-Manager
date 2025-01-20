import { withHttpMethods } from '../../../../middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';
import { withAuthentication } from '../../../../middleware/api/authenticationMiddleware';
import prisma from '../../../../prisma/prisma';
import { constants as HttpStatus } from 'http2';

export default withHttpMethods({
  [HTTPMethod.POST]: withAuthentication(async (req, res, user) => {
    const workspaceId = req.query.workspaceId as string | undefined;
    if (!workspaceId) {
      return res.status(HttpStatus.HTTP_STATUS_BAD_REQUEST).json(undefined);
    }
    const result = await prisma.workspaceJoinRequests.create({
      data: {
        userId: user.id,
        workspaceId: workspaceId,
      },
    });
    return res.json({ data: result });
  }),
});
