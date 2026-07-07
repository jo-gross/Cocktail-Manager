/**
 * v1 handler wiring for ice: validated, typed ctx → shared controllers (which
 * return clean DTOs). Ice has no image and no /check, so only collection + item.
 */
import { ApiError } from '@lib/http/ApiError';
import { icesCollectionApiDoc, icesItemApiDoc } from '@lib/schemas/ices';
import { defineApiHandlers } from '@lib/openapi/apiDoc';
import * as ices from '@lib/api/controllers/ices';

export const collectionHandler = defineApiHandlers(icesCollectionApiDoc.operations, {
  GET: ({ workspace, query }) => ices.listIces(workspace, query),
  POST: ({ workspace, body }) => ices.createIce(workspace, body),
});

export const itemHandler = defineApiHandlers(icesItemApiDoc.operations, {
  GET: async ({ workspace, params }) => {
    const ice = await ices.getIce(workspace, params.iceId);
    if (!ice) throw new ApiError(404, 'NOT_FOUND', 'Ice not found');
    return ice;
  },
  PUT: ({ workspace, params, body }) => ices.updateIce(workspace, params.iceId, body),
  DELETE: ({ workspace, params }) => ices.deleteIce(workspace, params.iceId),
});
