/**
 * v1 handler wiring for garnishes: validated, typed ctx → shared controllers
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
  garnishesCheckApiDoc,
  garnishesCloneApiDoc,
  garnishesCollectionApiDoc,
  garnishesExportJsonApiDoc,
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
  POST: ({ workspace, params, body }) => garnishes.cloneGarnish(workspace, params.garnishId, body.name),
});

// Export/import preserve the exact legacy JSON format (no { data } envelope) so the
// export→import round-trip keeps working; hence they are hand-wired instead of
// going through defineApiHandlers (which JSON-envelopes via sendOk).
const exportSpec = garnishesExportJsonApiDoc.operations.POST!;
export const exportJsonHandler = withHttpMethods({
  [HTTPMethod.POST]: withWorkspacePermission(exportSpec.roles, exportSpec.permission, async (req: NextApiRequest, res: NextApiResponse, _user, workspace) => {
    const { ids } = (req.body ?? {}) as { ids?: string[] };
    if (!ids || ids.length === 0) return res.status(400).json({ message: 'No garnishes selected' });

    try {
      const exportData = await garnishes.exportGarnishesJson(workspace, ids);
      return res.json(exportData);
    } catch (error) {
      if (error instanceof ApiError) return res.status(error.status).json({ message: error.message });
      console.error('Garnish export error:', error);
      return res.status(500).json({ message: 'Failed to export' });
    }
  }),
});

const importSpec = garnishesImportJsonApiDoc.operations.POST!;
export const importJsonHandler = withHttpMethods({
  [HTTPMethod.POST]: withWorkspacePermission(importSpec.roles, importSpec.permission, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    try {
      const result = await garnishes.importGarnishesJson(workspace, user, req.body);
      return res.json(result);
    } catch (error) {
      if (error instanceof ApiError) return res.status(error.status).json({ message: error.message });
      console.error('Garnish import error:', error);
      return res.status(500).json({ message: error instanceof Error ? error.message : 'Import failed' });
    }
  }),
});

export const imageHandler = withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.USER], Permission.GARNISHES_READ, async (req: NextApiRequest, res: NextApiResponse, _user, workspace) => {
    const garnishId = req.query.garnishId as string | undefined;
    if (!garnishId) return res.status(400).json(fail('VALIDATION_ERROR', 'No garnish id'));

    const image = await garnishes.getGarnishImage(workspace, garnishId);
    if (!image) return res.status(404).json(fail('NOT_FOUND', 'No garnish image found'));

    res.writeHead(200, { 'Content-Type': image.contentType, 'Content-Length': image.bytes.length });
    return res.send(image.bytes);
  }),
});
