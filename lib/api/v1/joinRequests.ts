/**
 * v1 handler wiring for workspace join requests: validated, typed ctx → shared controllers.
 * The collection DELETE (self-withdraw) is `sessionOnly` via its apiDoc.
 */
import { joinRequestsAcceptApiDoc, joinRequestsCollectionApiDoc, joinRequestsRejectApiDoc } from '@lib/schemas/joinRequests';
import { defineApiHandlers } from '@lib/openapi/apiDoc';
import * as joinRequests from '@lib/api/controllers/joinRequests';

export const collectionHandler = defineApiHandlers(joinRequestsCollectionApiDoc.operations, {
  GET: ({ workspace }) => joinRequests.listJoinRequests(workspace),
  DELETE: ({ workspace, user }) => joinRequests.withdrawOwnJoinRequest(workspace, user),
});

export const acceptHandler = defineApiHandlers(joinRequestsAcceptApiDoc.operations, {
  POST: ({ workspace, params }) => joinRequests.acceptJoinRequest(workspace, params.userId),
});

export const rejectHandler = defineApiHandlers(joinRequestsRejectApiDoc.operations, {
  POST: ({ workspace, params }) => joinRequests.rejectJoinRequest(workspace, params.userId),
});
