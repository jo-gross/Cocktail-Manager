import { withHttpMethods } from '../../../middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';
import { withAuthentication } from '../../../middleware/api/authenticationMiddleware';
import prisma from '../../../prisma/prisma';
import { constants as HttpStatus } from 'http2';

export default withHttpMethods({
  [HTTPMethod.POST]: withAuthentication(async (req, res, user) => {
    try {
      await prisma.$transaction(async (transaction) => {
        const code = req.query.code as string | undefined;
        console.log('Code:', code);
        if (!code) {
          return res.status(HttpStatus.HTTP_STATUS_BAD_REQUEST).json(undefined);
        }

        const findWorkspace = await transaction.workspaceJoinCode.findUnique({
          where: {
            code: code,
          },
        });

        if (!findWorkspace) {
          console.log('Code not found');
          return res.status(HttpStatus.HTTP_STATUS_BAD_REQUEST).json(undefined);
        }

        if (findWorkspace.expires && findWorkspace.expires < new Date()) {
          console.log('Code expired');
          return res.status(HttpStatus.HTTP_STATUS_BAD_REQUEST).json(undefined);
        }

        if (findWorkspace.onlyUseOnce && findWorkspace.used > 0) {
          console.log('Code already used');
          return res.status(HttpStatus.HTTP_STATUS_BAD_REQUEST).json(undefined);
        }

        await transaction.workspaceJoinCode.update({
          where: {
            code: code,
          },
          data: {
            used: findWorkspace.used + 1,
          },
        });

        const result = await transaction.workspaceJoinRequest.create({
          data: {
            userId: user.id,
            workspaceId: findWorkspace.workspaceId,
          },
        });
        return res.json({ data: result });
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ msg: 'Error' });
    }
  }),
});
