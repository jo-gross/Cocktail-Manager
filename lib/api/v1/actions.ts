/**
 * v1 handler wiring for step actions: validated, typed ctx → shared controllers
 * (which return clean DTOs). Collection (list + create) and item (update + delete);
 * there is no item GET (the legacy resource had none).
 */
import { actionsCollectionApiDoc, actionsItemApiDoc } from '@lib/schemas/actions';
import { defineApiHandlers } from '@lib/openapi/apiDoc';
import * as actions from '@lib/api/controllers/actions';

export const collectionHandler = defineApiHandlers(actionsCollectionApiDoc.operations, {
  GET: ({ workspace, query }) => actions.listActions(workspace, query),
  POST: ({ workspace, body }) => actions.createAction(workspace, body),
});

export const itemHandler = defineApiHandlers(actionsItemApiDoc.operations, {
  PUT: ({ workspace, params, body }) => actions.updateAction(workspace, params.actionId, body),
  DELETE: ({ workspace, params }) => actions.deleteAction(workspace, params.actionId),
});
