/**
 * v1 handler wiring for units and unit conversions: validated, typed ctx →
 * shared controllers (which return clean DTOs). Units have no image and no
 * /check, so only collection + item; conversions add their own collection + item.
 */
import { unitConversionsCollectionApiDoc, unitConversionsItemApiDoc, unitsCollectionApiDoc, unitsItemApiDoc } from '@lib/schemas/units';
import { defineApiHandlers } from '@lib/openapi/apiDoc';
import * as units from '@lib/api/controllers/units';

export const collectionHandler = defineApiHandlers(unitsCollectionApiDoc.operations, {
  GET: ({ workspace, query }) => units.listUnits(workspace, query),
  POST: ({ workspace, body }) => units.createUnit(workspace, body),
});

export const itemHandler = defineApiHandlers(unitsItemApiDoc.operations, {
  DELETE: ({ params }) => units.deleteUnit(params.unitId),
});

export const conversionsCollectionHandler = defineApiHandlers(unitConversionsCollectionApiDoc.operations, {
  GET: ({ workspace }) => units.listUnitConversions(workspace),
  POST: ({ workspace, body }) => units.createUnitConversion(workspace, body),
});

export const conversionsItemHandler = defineApiHandlers(unitConversionsItemApiDoc.operations, {
  PUT: ({ workspace, params, body }) => units.updateUnitConversion(workspace, params.unitConversionId, body),
  DELETE: ({ workspace, params }) => units.deleteUnitConversion(workspace, params.unitConversionId),
});
