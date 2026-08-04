/**
 * v1 handler wiring for workspace join codes: validated, typed ctx → shared controllers.
 */
import { joinCodesCollectionApiDoc, joinCodesItemApiDoc } from '@lib/schemas/joinCodes';
import { defineApiHandlers } from '@lib/openapi/apiDoc';
import * as joinCodes from '@lib/api/controllers/joinCodes';

export const collectionHandler = defineApiHandlers(joinCodesCollectionApiDoc.operations, {
  GET: ({ workspace }) => joinCodes.listJoinCodes(workspace),
  POST: ({ workspace, body }) => joinCodes.createJoinCode(workspace, body),
});

export const itemHandler = defineApiHandlers(joinCodesItemApiDoc.operations, {
  DELETE: ({ workspace, params }) => joinCodes.deleteJoinCode(workspace, params.code),
});
