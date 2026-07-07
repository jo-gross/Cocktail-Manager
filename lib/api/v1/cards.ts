/**
 * v1 handler wiring for cards: validated, typed ctx → shared controllers
 * (which return clean DTOs). Collection GET returns slim summaries; item GET
 * returns the full card (404 via ApiError when missing).
 */
import { ApiError } from '@lib/http/ApiError';
import { cardsArchiveApiDoc, cardsCloneApiDoc, cardsCollectionApiDoc, cardsItemApiDoc, cardsUnarchiveApiDoc } from '@lib/schemas/cards';
import { defineApiHandlers } from '@lib/openapi/apiDoc';
import * as cards from '@lib/api/controllers/cards';

export const collectionHandler = defineApiHandlers(cardsCollectionApiDoc.operations, {
  GET: ({ workspace, query }) => cards.listCards(workspace, query),
  POST: ({ workspace, body }) => cards.createCard(workspace, body),
});

export const itemHandler = defineApiHandlers(cardsItemApiDoc.operations, {
  GET: async ({ workspace, params }) => {
    const card = await cards.getCard(workspace, params.cardId);
    if (!card) throw new ApiError(404, 'NOT_FOUND', 'Card not found');
    return card;
  },
  PUT: ({ workspace, params, body }) => cards.updateCard(workspace, params.cardId, body),
  DELETE: ({ workspace, params }) => cards.deleteCard(workspace, params.cardId),
});

export const archiveHandler = defineApiHandlers(cardsArchiveApiDoc.operations, {
  PUT: ({ workspace, params }) => cards.archiveCard(workspace, params.cardId, true),
});

export const unarchiveHandler = defineApiHandlers(cardsUnarchiveApiDoc.operations, {
  PUT: ({ workspace, params }) => cards.archiveCard(workspace, params.cardId, false),
});

export const cloneHandler = defineApiHandlers(cardsCloneApiDoc.operations, {
  POST: ({ workspace, params, body }) => cards.cloneCard(workspace, params.cardId, body.name),
});
