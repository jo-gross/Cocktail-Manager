/**
 * v1 handler wiring for glasses: validated, typed ctx → shared controllers
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
  GlassExportJsonBodySchema,
  GlassImportJsonBodySchema,
  GlassItemParams,
  glassesCheckApiDoc,
  glassesCloneApiDoc,
  glassesCollectionApiDoc,
  glassesExportJsonApiDoc,
  glassesImageApiDoc,
  glassesImportJsonApiDoc,
  glassesItemApiDoc,
  glassesReferencesApiDoc,
} from '@lib/schemas/glasses';
import { defineApiHandlers } from '@lib/openapi/apiDoc';
import * as glasses from '@lib/api/controllers/glasses';

export const collectionHandler = defineApiHandlers(glassesCollectionApiDoc.operations, {
  GET: ({ workspace, query }) => glasses.listGlasses(workspace, query),
  POST: ({ workspace, user, body }) => glasses.createGlass(workspace, user, body),
});

export const itemHandler = defineApiHandlers(glassesItemApiDoc.operations, {
  GET: async ({ workspace, params }) => {
    const glass = await glasses.getGlass(workspace, params.glassId);
    if (!glass) throw new ApiError(404, 'NOT_FOUND', 'Glass not found');
    return glass;
  },
  PUT: ({ workspace, user, params, body }) => glasses.updateGlass(workspace, user, params.glassId, body),
  DELETE: ({ workspace, user, params }) => glasses.deleteGlass(workspace, user, params.glassId),
});

export const checkHandler = defineApiHandlers(glassesCheckApiDoc.operations, {
  GET: ({ workspace, query }) => glasses.checkGlass(workspace, query.name),
});

export const cloneHandler = defineApiHandlers(glassesCloneApiDoc.operations, {
  POST: ({ workspace, user, params, body }) => glasses.cloneGlass(workspace, user, params.glassId, body.name),
});

export const referencesHandler = defineApiHandlers(glassesReferencesApiDoc.operations, {
  GET: ({ workspace, params }) => glasses.getGlassReferences(workspace, params.glassId),
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
const exportSpec = glassesExportJsonApiDoc.operations.POST;
export const exportJsonHandler = withHttpMethods({
  [HTTPMethod.POST]: withWorkspacePermission(exportSpec.roles, exportSpec.permission, async (req: NextApiRequest, res: NextApiResponse, _user, workspace) => {
    const parsed = GlassExportJsonBodySchema.safeParse(req.body);
    if (!parsed.success) return sendRawError(res, new ApiError(400, 'VALIDATION_ERROR', 'No valid glasses selected', parsed.error.issues), 'Failed to export');

    try {
      return res.json(await glasses.exportGlassesJson(workspace, parsed.data.ids));
    } catch (error) {
      return sendRawError(res, error, 'Failed to export');
    }
  }),
});

const importSpec = glassesImportJsonApiDoc.operations.POST;
export const importJsonHandler = withHttpMethods({
  [HTTPMethod.POST]: withWorkspacePermission(importSpec.roles, importSpec.permission, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const parsed = GlassImportJsonBodySchema.safeParse(req.body);
    if (!parsed.success) return sendRawError(res, new ApiError(400, 'VALIDATION_ERROR', 'Invalid import request', parsed.error.issues), 'Import failed');

    try {
      return res.json(await glasses.importGlassesJson(workspace, user, parsed.data));
    } catch (error) {
      return sendRawError(res, error, 'Import failed');
    }
  }),
});

const imageSpec = glassesImageApiDoc.operations.GET;
export const imageHandler = withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission(imageSpec.roles, imageSpec.permission, async (req: NextApiRequest, res: NextApiResponse, _user, workspace) => {
    const params = GlassItemParams.safeParse(req.query);
    if (!params.success) return res.status(400).json(fail('VALIDATION_ERROR', 'Invalid request params', params.error.issues));

    const image = await glasses.getGlassImage(workspace, params.data.glassId);
    if (!image) return res.status(404).json(fail('NOT_FOUND', 'No glass image found'));

    return sendImage(res, image);
  }),
});
