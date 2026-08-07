/**
 * v1 handler wiring for ingredients: validated, typed ctx → shared controllers
 * (which return clean DTOs). The image endpoint serves binary bytes and is
 * therefore hand-wired (outside defineApiHandlers, which JSON-envelopes).
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import HTTPMethod from 'http-method-enum';
import { Permission, Role } from '@generated/prisma/client';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { fail } from '@lib/http/responses';
import { ApiError } from '@lib/http/ApiError';
import {
  ingredientsCheckApiDoc,
  ingredientsCloneApiDoc,
  ingredientsCollectionApiDoc,
  ingredientsExportJsonApiDoc,
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
  POST: ({ workspace, params, body }) => ingredients.cloneIngredient(workspace, params.ingredientId, body.name),
});

export const referencesHandler = defineApiHandlers(ingredientsReferencesApiDoc.operations, {
  GET: ({ workspace, params }) => ingredients.getIngredientReferences(workspace, params.ingredientId),
});

// Export/import preserve the exact legacy JSON format (no { data } envelope) so the
// export→import round-trip keeps working; hence they are hand-wired instead of
// going through defineApiHandlers (which JSON-envelopes via sendOk).
const exportSpec = ingredientsExportJsonApiDoc.operations.POST!;
export const exportJsonHandler = withHttpMethods({
  [HTTPMethod.POST]: withWorkspacePermission(exportSpec.roles, exportSpec.permission, async (req: NextApiRequest, res: NextApiResponse, _user, workspace) => {
    const { ids } = (req.body ?? {}) as { ids?: string[] };
    if (!ids || ids.length === 0) return res.status(400).json({ message: 'No ingredients selected' });

    try {
      const exportData = await ingredients.exportIngredientsJson(workspace, ids);
      return res.json(exportData);
    } catch (error) {
      if (error instanceof ApiError) return res.status(error.status).json({ message: error.message });
      console.error('Ingredient export error:', error);
      return res.status(500).json({ message: 'Failed to export' });
    }
  }),
});

const importSpec = ingredientsImportJsonApiDoc.operations.POST!;
export const importJsonHandler = withHttpMethods({
  [HTTPMethod.POST]: withWorkspacePermission(importSpec.roles, importSpec.permission, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    try {
      const result = await ingredients.importIngredientsJson(workspace, user, req.body);
      return res.json(result);
    } catch (error) {
      if (error instanceof ApiError) return res.status(error.status).json({ message: error.message });
      console.error('Ingredient import error:', error);
      return res.status(500).json({ message: error instanceof Error ? error.message : 'Import failed' });
    }
  }),
});

export const imageHandler = withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.USER], Permission.INGREDIENTS_READ, async (req: NextApiRequest, res: NextApiResponse, _user, workspace) => {
    const ingredientId = req.query.ingredientId as string | undefined;
    if (!ingredientId) return res.status(400).json(fail('VALIDATION_ERROR', 'No ingredient id'));

    const image = await ingredients.getIngredientImage(workspace, ingredientId);
    if (!image) return res.status(404).json(fail('NOT_FOUND', 'No ingredient image found'));

    res.writeHead(200, { 'Content-Type': image.contentType, 'Content-Length': image.bytes.length });
    return res.send(image.bytes);
  }),
});
