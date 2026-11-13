/**
 * v1 handler wiring for ingredients: validated, typed ctx → shared controllers
 * (which return clean DTOs). The image endpoint serves binary bytes and is
 * therefore hand-wired (outside defineApiHandlers, which JSON-envelopes).
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import HTTPMethod from 'http-method-enum';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { fail } from '@lib/http/responses';
import { ApiError } from '@lib/http/ApiError';
import { prismaErrorToApiError } from '@lib/http/prismaErrors';
import { sendImage } from '@lib/images/imageResponse';
import {
  IngredientExportJsonBodySchema,
  IngredientImportJsonBodySchema,
  IngredientItemParams,
  ingredientsCheckApiDoc,
  ingredientsCloneApiDoc,
  ingredientsCollectionApiDoc,
  ingredientsExportJsonApiDoc,
  ingredientsImageApiDoc,
  ingredientsImportJsonApiDoc,
  ingredientsItemApiDoc,
  ingredientsReferencesApiDoc,
} from '@lib/schemas/ingredients';
import { defineApiHandlers } from '@lib/openapi/apiDoc';
import * as ingredients from '@lib/api/controllers/ingredients';

export const collectionHandler = defineApiHandlers(ingredientsCollectionApiDoc.operations, {
  GET: ({ workspace, query }) => ingredients.listIngredients(workspace, query),
  POST: ({ workspace, user, body }) => ingredients.createIngredient(workspace, user, body),
});

export const itemHandler = defineApiHandlers(ingredientsItemApiDoc.operations, {
  GET: async ({ workspace, params }) => {
    const ingredient = await ingredients.getIngredient(workspace, params.ingredientId);
    if (!ingredient) throw new ApiError(404, 'NOT_FOUND', 'Ingredient not found');
    return ingredient;
  },
  PUT: ({ workspace, user, params, body }) => ingredients.updateIngredient(workspace, user, params.ingredientId, body),
  DELETE: ({ workspace, user, params }) => ingredients.deleteIngredient(workspace, user, params.ingredientId),
});

export const checkHandler = defineApiHandlers(ingredientsCheckApiDoc.operations, {
  GET: ({ workspace, query }) => ingredients.checkIngredient(workspace, query),
});

export const cloneHandler = defineApiHandlers(ingredientsCloneApiDoc.operations, {
  POST: ({ workspace, user, params, body }) => ingredients.cloneIngredient(workspace, user, params.ingredientId, body.name),
});

export const referencesHandler = defineApiHandlers(ingredientsReferencesApiDoc.operations, {
  GET: ({ workspace, params }) => ingredients.getIngredientReferences(workspace, params.ingredientId),
});

/**
 * Error body of the raw export/import endpoints: the legacy top-level `message`
 * (read by the frontend) plus the standard v1 `error` object. Unexpected errors
 * are logged and answered generically.
 */
function sendRawError(res: NextApiResponse, error: unknown, fallbackMessage: string) {
  const apiError = prismaErrorToApiError(error);
  if (apiError) return res.status(apiError.status).json({ message: apiError.message, ...fail(apiError.code, apiError.message, apiError.issues) });
  console.error(`${fallbackMessage}:`, error);
  return res.status(500).json({ message: fallbackMessage, ...fail('INTERNAL_ERROR', fallbackMessage) });
}

// Export/import preserve the exact legacy JSON format (no { data } envelope) so the
// export→import round-trip keeps working; hence they are hand-wired instead of
// going through defineApiHandlers (which JSON-envelopes via sendOk).
const exportSpec = ingredientsExportJsonApiDoc.operations.POST;
export const exportJsonHandler = withHttpMethods({
  [HTTPMethod.POST]: withWorkspacePermission(exportSpec.roles, exportSpec.permission, async (req: NextApiRequest, res: NextApiResponse, _user, workspace) => {
    const parsed = IngredientExportJsonBodySchema.safeParse(req.body);
    if (!parsed.success)
      return sendRawError(res, new ApiError(400, 'VALIDATION_ERROR', 'No valid ingredients selected', parsed.error.issues), 'Failed to export');

    try {
      return res.json(await ingredients.exportIngredientsJson(workspace, parsed.data.ids));
    } catch (error) {
      return sendRawError(res, error, 'Failed to export');
    }
  }),
});

const importSpec = ingredientsImportJsonApiDoc.operations.POST;
export const importJsonHandler = withHttpMethods({
  [HTTPMethod.POST]: withWorkspacePermission(importSpec.roles, importSpec.permission, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const parsed = IngredientImportJsonBodySchema.safeParse(req.body);
    if (!parsed.success) return sendRawError(res, new ApiError(400, 'VALIDATION_ERROR', 'Invalid import request', parsed.error.issues), 'Import failed');

    try {
      return res.json(await ingredients.importIngredientsJson(workspace, user, parsed.data));
    } catch (error) {
      return sendRawError(res, error, 'Import failed');
    }
  }),
});

const imageSpec = ingredientsImageApiDoc.operations.GET;
export const imageHandler = withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission(imageSpec.roles, imageSpec.permission, async (req: NextApiRequest, res: NextApiResponse, _user, workspace) => {
    const params = IngredientItemParams.safeParse(req.query);
    if (!params.success) return res.status(400).json(fail('VALIDATION_ERROR', 'Invalid request params', params.error.issues));

    const image = await ingredients.getIngredientImage(workspace, params.data.ingredientId);
    if (!image) return res.status(404).json(fail('NOT_FOUND', 'No ingredient image found'));

    return sendImage(res, image);
  }),
});
