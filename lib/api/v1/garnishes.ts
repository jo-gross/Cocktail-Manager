/**
 * v1 handler wiring for garnishes: validated, typed ctx → shared controllers
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
  GarnishExportJsonBodySchema,
  GarnishImportJsonBodySchema,
  GarnishItemParams,
  garnishesCheckApiDoc,
  garnishesCloneApiDoc,
  garnishesCollectionApiDoc,
  garnishesExportJsonApiDoc,
  garnishesImageApiDoc,
  garnishesImportJsonApiDoc,
  garnishesItemApiDoc,
} from '@lib/schemas/garnishes';
import { defineApiHandlers } from '@lib/openapi/apiDoc';
import * as garnishes from '@lib/api/controllers/garnishes';

export const collectionHandler = defineApiHandlers(garnishesCollectionApiDoc.operations, {
  GET: ({ workspace, query }) => garnishes.listGarnishes(workspace, query),
  POST: ({ workspace, user, body }) => garnishes.createGarnish(workspace, user, body),
});

export const itemHandler = defineApiHandlers(garnishesItemApiDoc.operations, {
  GET: async ({ workspace, params }) => {
    const garnish = await garnishes.getGarnish(workspace, params.garnishId);
    if (!garnish) throw new ApiError(404, 'NOT_FOUND', 'Garnish not found');
    return garnish;
  },
  PUT: ({ workspace, user, params, body }) => garnishes.updateGarnish(workspace, user, params.garnishId, body),
  DELETE: ({ workspace, user, params }) => garnishes.deleteGarnish(workspace, user, params.garnishId),
});

export const checkHandler = defineApiHandlers(garnishesCheckApiDoc.operations, {
  GET: ({ workspace, query }) => garnishes.checkGarnish(workspace, query.name),
});

export const cloneHandler = defineApiHandlers(garnishesCloneApiDoc.operations, {
  POST: ({ workspace, user, params, body }) => garnishes.cloneGarnish(workspace, user, params.garnishId, body.name),
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
const exportSpec = garnishesExportJsonApiDoc.operations.POST;
export const exportJsonHandler = withHttpMethods({
  [HTTPMethod.POST]: withWorkspacePermission(exportSpec.roles, exportSpec.permission, async (req: NextApiRequest, res: NextApiResponse, _user, workspace) => {
    const parsed = GarnishExportJsonBodySchema.safeParse(req.body);
    if (!parsed.success)
      return sendRawError(res, new ApiError(400, 'VALIDATION_ERROR', 'No valid garnishes selected', parsed.error.issues), 'Failed to export');

    try {
      return res.json(await garnishes.exportGarnishesJson(workspace, parsed.data.ids));
    } catch (error) {
      return sendRawError(res, error, 'Failed to export');
    }
  }),
});

const importSpec = garnishesImportJsonApiDoc.operations.POST;
export const importJsonHandler = withHttpMethods({
  [HTTPMethod.POST]: withWorkspacePermission(importSpec.roles, importSpec.permission, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const parsed = GarnishImportJsonBodySchema.safeParse(req.body);
    if (!parsed.success) return sendRawError(res, new ApiError(400, 'VALIDATION_ERROR', 'Invalid import request', parsed.error.issues), 'Import failed');

    try {
      return res.json(await garnishes.importGarnishesJson(workspace, user, parsed.data));
    } catch (error) {
      return sendRawError(res, error, 'Import failed');
    }
  }),
});

const imageSpec = garnishesImageApiDoc.operations.GET;
export const imageHandler = withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission(imageSpec.roles, imageSpec.permission, async (req: NextApiRequest, res: NextApiResponse, _user, workspace) => {
    const params = GarnishItemParams.safeParse(req.query);
    if (!params.success) return res.status(400).json(fail('VALIDATION_ERROR', 'Invalid request params', params.error.issues));

    const image = await garnishes.getGarnishImage(workspace, params.data.garnishId);
    if (!image) return res.status(404).json(fail('NOT_FOUND', 'No garnish image found'));

    return sendImage(res, image);
  }),
});
