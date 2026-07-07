import { withHttpMethods } from '@middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { Role } from '@generated/prisma/client';
import prisma from '../../../../../prisma/prisma';
import { withDeprecation } from '@middleware/api/withDeprecation';

const legacyHandler = withHttpMethods({
  [HTTPMethod.DELETE]: withWorkspacePermission([Role.ADMIN], null, async (req, res, _user, _workspace) => {
    const unitId = req.query.unitId as string | undefined;
    if (!unitId) return res.status(400).json({ message: 'No unit id' });

    const unit = await prisma.unit.delete({ where: { id: unitId } });
    return res.json({ data: unit });
  }),
});

// DEPRECATED: unversioned endpoint kept for backward compatibility. Behavior is
// unchanged; only advertises the successor v1 path. Use /api/v1/... instead.
export default withDeprecation({ successor: '/api/v1/workspaces/{workspaceId}/units/{unitId}' }, legacyHandler);
