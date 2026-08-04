/**
 * v1 handler wiring for the queue: validated, typed ctx → shared controllers
 * (which return clean DTOs). Queue uses action-style paths (add/remove) mirrored
 * 1:1 from the legacy handlers, plus an item route for the in-progress update.
 */
import { queueAddApiDoc, queueCollectionApiDoc, queueItemApiDoc, queueRemoveApiDoc } from '@lib/schemas/queue';
import { defineApiHandlers } from '@lib/openapi/apiDoc';
import * as queue from '@lib/api/controllers/queue';

export const collectionHandler = defineApiHandlers(queueCollectionApiDoc.operations, {
  GET: ({ workspace }) => queue.listQueue(workspace),
});

export const addHandler = defineApiHandlers(queueAddApiDoc.operations, {
  POST: ({ workspace, body }) => queue.addToQueue(workspace, body),
});

export const removeHandler = defineApiHandlers(queueRemoveApiDoc.operations, {
  POST: ({ workspace, body }) => queue.removeFromQueue(workspace, body),
});

export const itemHandler = defineApiHandlers(queueItemApiDoc.operations, {
  PUT: ({ workspace, params, body }) => queue.updateQueueItem(workspace, params.queueItemId, body),
});
