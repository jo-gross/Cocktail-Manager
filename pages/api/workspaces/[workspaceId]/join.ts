import { withHttpMethods } from '../../../../middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';
import { withAuthentication } from '../../../../middleware/api/authenticationMiddleware';
import prisma from '../../../../lib/prisma';
import { Role } from '@prisma/client';
import { constants as HttpStatus } from 'http2';

export default withHttpMethods({
  [HTTPMethod.POST]: withAuthentication(async (req, res, user) => {
    const workspaceId = req.query.workspaceId as string | undefined;
    if (!workspaceId) {
      return res.status(HttpStatus.HTTP_STATUS_BAD_REQUEST).json(undefined);
    }
    const result = await prisma.workspaceUser.create({
      data: {
        userId: user.id,
        workspaceId: workspaceId,
        role: Role.USER,
      },
    });
    return res.json({ data: result });
  }),
});
