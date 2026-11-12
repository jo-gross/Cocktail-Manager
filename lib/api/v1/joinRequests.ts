/**
 * v1 handler wiring for workspace join requests: validated, typed ctx → shared controllers.
 *
 * The collection DELETE (withdraw one's OWN request) is hand-wired: the applicant is by definition
 * not a member yet, so the membership-checking workspace middleware would always reject them. It
 * is session-only (no API keys) and only ever touches the caller's own request.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import HTTPMethod from 'http-method-enum';
import type { User } from '@generated/prisma/client';
import { joinRequestsAcceptApiDoc, joinRequestsCollectionApiDoc, joinRequestsRejectApiDoc } from '@lib/schemas/joinRequests';
import { defineApiHandlers } from '@lib/openapi/apiDoc';
import { withAuthentication } from '@middleware/api/authenticationMiddleware';
import { sendFail, sendOk } from '@lib/http/responses';
import { withHttpMethods } from '@middleware/api/handleMethods';
import * as joinRequests from '@lib/api/controllers/joinRequests';

const { GET: listSpec, DELETE: withdrawSpec } = joinRequestsCollectionApiDoc.operations;

const listHandler = defineApiHandlers(
  { GET: listSpec },
  {
    GET: ({ workspace }) => joinRequests.listJoinRequests(workspace),
  },
);

// withHttpMethods maps ApiErrors / Prisma errors to error envelopes.
const withdrawHandler = withHttpMethods({
  [HTTPMethod.DELETE]: withAuthentication(async (req: NextApiRequest, res: NextApiResponse, user: User) => {
    const params = withdrawSpec.params.safeParse(req.query);
    if (!params.success) return sendFail(res, 400, 'VALIDATION_ERROR', 'Invalid request params', params.error.issues);
    return sendOk(res, await joinRequests.withdrawOwnJoinRequest(params.data.workspaceId, user));
  }),
});

export const collectionHandler = (req: NextApiRequest, res: NextApiResponse) => (req.method === 'DELETE' ? withdrawHandler(req, res) : listHandler(req, res));

export const acceptHandler = defineApiHandlers(joinRequestsAcceptApiDoc.operations, {
  POST: ({ workspace, user, params }) => joinRequests.acceptJoinRequest(workspace, user, params.userId),
});

export const rejectHandler = defineApiHandlers(joinRequestsRejectApiDoc.operations, {
  POST: ({ workspace, params }) => joinRequests.rejectJoinRequest(workspace, params.userId),
});
