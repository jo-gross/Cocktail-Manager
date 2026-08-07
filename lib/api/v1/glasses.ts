/**
 * v1 handler wiring for glasses: validated, typed ctx → shared controllers
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
  glassesCheckApiDoc,
  glassesCloneApiDoc,
  glassesCollectionApiDoc,
  glassesExportJsonApiDoc,
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
  POST: ({ workspace, params, body }) => glasses.cloneGlass(workspace, params.glassId, body.name),
});

export const referencesHandler = defineApiHandlers(glassesReferencesApiDoc.operations, {
  GET: ({ workspace, params }) => glasses.getGlassReferences(workspace, params.glassId),
});

// Export/import preserve the exact legacy JSON format (no { data } envelope) so the
// export→import round-trip keeps working; hence they are hand-wired instead of
// going through defineApiHandlers (which JSON-envelopes via sendOk).
const exportSpec = glassesExportJsonApiDoc.operations.POST!;
export const exportJsonHandler = withHttpMethods({
  [HTTPMethod.POST]: withWorkspacePermission(exportSpec.roles, exportSpec.permission, async (req: NextApiRequest, res: NextApiResponse, _user, workspace) => {
    const { ids } = (req.body ?? {}) as { ids?: string[] };
    if (!ids || ids.length === 0) return res.status(400).json({ message: 'No glasses selected' });

    try {
      const exportData = await glasses.exportGlassesJson(workspace, ids);
      return res.json(exportData);
    } catch (error) {
      if (error instanceof ApiError) return res.status(error.status).json({ message: error.message });
      console.error('Glass export error:', error);
      return res.status(500).json({ message: 'Failed to export' });
    }
  }),
});

const importSpec = glassesImportJsonApiDoc.operations.POST!;
export const importJsonHandler = withHttpMethods({
  [HTTPMethod.POST]: withWorkspacePermission(importSpec.roles, importSpec.permission, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    try {
      const result = await glasses.importGlassesJson(workspace, user, req.body);
      return res.json(result);
    } catch (error) {
      if (error instanceof ApiError) return res.status(error.status).json({ message: error.message });
      console.error('Glass import error:', error);
      return res.status(500).json({ message: error instanceof Error ? error.message : 'Import failed' });
    }
  }),
});

export const imageHandler = withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.USER], Permission.GLASSES_READ, async (req: NextApiRequest, res: NextApiResponse, _user, workspace) => {
    const glassId = req.query.glassId as string | undefined;
    if (!glassId) return res.status(400).json(fail('VALIDATION_ERROR', 'No glass id'));

    const image = await glasses.getGlassImage(workspace, glassId);
    if (!image) return res.status(404).json(fail('NOT_FOUND', 'No glass image found'));

    res.writeHead(200, { 'Content-Type': image.contentType, 'Content-Length': image.bytes.length });
    return res.send(image.bytes);
  }),
});
