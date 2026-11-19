/** Handler wiring of the support writes of the instance API (master key only); workspace deletion is wired in `instance.ts`. */
import { instanceUsersSessionsApiDoc, instanceWorkspacesTransferOwnershipApiDoc } from '@lib/schemas/instanceSupport';
import { defineApiHandlers } from '@lib/openapi/apiDoc';
import * as support from '@lib/api/controllers/instanceSupport';

export const transferOwnershipHandler = defineApiHandlers(instanceWorkspacesTransferOwnershipApiDoc.operations, {
  POST: ({ req, params, body }) => support.transferOwnership(req.headers, params.id, body),
});

export const userSessionsHandler = defineApiHandlers(instanceUsersSessionsApiDoc.operations, {
  DELETE: ({ req, params }) => support.revokeUserSessions(req.headers, params.id),
});
