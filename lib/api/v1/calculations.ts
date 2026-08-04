/**
 * v1 handler wiring for calculations: validated, typed ctx → shared controllers
 * (which return clean DTOs). Collection GET returns slim summaries; item GET
 * returns the full calculation (404 via ApiError when missing).
 */
import { ApiError } from '@lib/http/ApiError';
import {
  calculationGroupsAssignApiDoc,
  calculationGroupsCollectionApiDoc,
  calculationGroupsItemApiDoc,
  calculationsCollectionApiDoc,
  calculationsExportJsonApiDoc,
  calculationsImportJsonApiDoc,
  calculationsItemApiDoc,
} from '@lib/schemas/calculations';
import { defineApiHandlers } from '@lib/openapi/apiDoc';
import * as calculations from '@lib/api/controllers/calculations';

export const collectionHandler = defineApiHandlers(calculationsCollectionApiDoc.operations, {
  GET: ({ workspace }) => calculations.listCalculations(workspace),
  POST: ({ workspace, user, body }) => calculations.createCalculation(workspace, user, body),
});

export const itemHandler = defineApiHandlers(calculationsItemApiDoc.operations, {
  GET: async ({ workspace, params }) => {
    const calculation = await calculations.getCalculation(workspace, params.calculationId);
    if (!calculation) throw new ApiError(404, 'NOT_FOUND', 'Calculation not found');
    return calculation;
  },
  PUT: ({ workspace, user, params, body }) => calculations.updateCalculation(workspace, user, params.calculationId, body),
  DELETE: ({ workspace, user, params }) => calculations.deleteCalculation(workspace, user, params.calculationId),
});

export const groupsCollectionHandler = defineApiHandlers(calculationGroupsCollectionApiDoc.operations, {
  GET: ({ workspace }) => calculations.listCalculationGroups(workspace),
  POST: ({ workspace, body }) => calculations.createCalculationGroup(workspace, body),
});

export const groupsItemHandler = defineApiHandlers(calculationGroupsItemApiDoc.operations, {
  PUT: ({ workspace, params, body }) => calculations.updateCalculationGroup(workspace, params.groupId, body),
  DELETE: ({ workspace, params }) => calculations.deleteCalculationGroup(workspace, params.groupId),
});

export const groupsAssignHandler = defineApiHandlers(calculationGroupsAssignApiDoc.operations, {
  POST: ({ workspace, body }) => calculations.assignCalculationsToGroup(workspace, body),
});

// The export/import JSON payloads are round-trip formats returned VERBATIM
// (not wrapped in a { data } envelope). The handlers write the response
// directly and return undefined so withValidation skips re-sending.
export const exportJsonHandler = defineApiHandlers(calculationsExportJsonApiDoc.operations, {
  POST: async ({ res, workspace, body }) => {
    const result = await calculations.exportCalculationsJson(workspace, body);
    res.status(200).json(result);
  },
});

export const importJsonHandler = defineApiHandlers(calculationsImportJsonApiDoc.operations, {
  POST: async ({ res, workspace, user, body }) => {
    const result = await calculations.importCalculationsJson(workspace, user, body);
    res.status(200).json(result);
  },
});
