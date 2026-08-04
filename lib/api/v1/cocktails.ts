/**
 * v1 handler wiring for cocktails: validated, typed ctx → shared controllers
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
  cocktailsArchiveApiDoc,
  cocktailsCheckApiDoc,
  cocktailsCloneApiDoc,
  cocktailsCollectionApiDoc,
  cocktailsExportJsonApiDoc,
  cocktailsExportPdfApiDoc,
  cocktailsImportJsonApiDoc,
  cocktailsItemApiDoc,
  cocktailsUnarchiveApiDoc,
} from '@lib/schemas/cocktails';
import { defineApiHandlers } from '@lib/openapi/apiDoc';
import * as cocktails from '@lib/api/controllers/cocktails';
import * as cocktailsPorting from '@lib/api/controllers/cocktailsPorting';

export const collectionHandler = defineApiHandlers(cocktailsCollectionApiDoc.operations, {
  GET: ({ workspace, query }) => cocktails.listCocktails(workspace, query),
  POST: ({ workspace, user, body }) => cocktails.createCocktail(workspace, user, body),
});

export const itemHandler = defineApiHandlers(cocktailsItemApiDoc.operations, {
  GET: async ({ workspace, params }) => {
    const cocktail = await cocktails.getCocktail(workspace, params.cocktailId);
    if (!cocktail) throw new ApiError(404, 'NOT_FOUND', 'Cocktail not found');
    return cocktail;
  },
  PUT: ({ workspace, user, params, body }) => cocktails.updateCocktail(workspace, user, params.cocktailId, body),
  DELETE: ({ workspace, user, params }) => cocktails.deleteCocktail(workspace, user, params.cocktailId),
});

export const checkHandler = defineApiHandlers(cocktailsCheckApiDoc.operations, {
  GET: ({ workspace, query }) => cocktails.checkCocktail(workspace, query.name),
});

export const imageHandler = withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.USER], Permission.COCKTAILS_READ, async (req: NextApiRequest, res: NextApiResponse, _user, workspace) => {
    const cocktailId = req.query.cocktailId as string | undefined;
    if (!cocktailId) return res.status(400).json(fail('VALIDATION_ERROR', 'No cocktail id'));

    const image = await cocktails.getCocktailImage(workspace, cocktailId);
    if (!image) return res.status(404).json(fail('NOT_FOUND', 'No cocktail image found'));

    res.writeHead(200, { 'Content-Type': image.contentType, 'Content-Length': image.bytes.length });
    return res.send(image.bytes);
  }),
});

export const cloneHandler = defineApiHandlers(cocktailsCloneApiDoc.operations, {
  POST: ({ workspace, user, params, body }) => cocktails.cloneCocktail(workspace, user, params.cocktailId, body.name),
});

export const archiveHandler = defineApiHandlers(cocktailsArchiveApiDoc.operations, {
  PUT: ({ workspace, params }) => cocktails.archiveCocktail(workspace, params.cocktailId, true),
});

export const unarchiveHandler = defineApiHandlers(cocktailsUnarchiveApiDoc.operations, {
  PUT: ({ workspace, params }) => cocktails.archiveCocktail(workspace, params.cocktailId, false),
});

// Export/import serve the raw legacy data-dump format (NOT the clean DTO envelope)
// so the export → import round-trip stays lossless. They are therefore hand-wired
// (roles/permission still single-sourced from the ApiDoc) and write the controller
// results verbatim, exactly as the legacy handlers did.

const exportJsonSpec = cocktailsExportJsonApiDoc.operations.POST!;
export const exportJsonHandler = withHttpMethods({
  [HTTPMethod.POST]: withWorkspacePermission(
    exportJsonSpec.roles,
    exportJsonSpec.permission,
    async (req: NextApiRequest, res: NextApiResponse, _user, workspace) => {
      const { cocktailIds } = (req.body ?? {}) as { cocktailIds?: string[] };
      const result = await cocktailsPorting.exportCocktailsJson(workspace, cocktailIds ?? []);
      return res.status(result.status).json(result.body);
    },
  ),
});

const exportPdfSpec = cocktailsExportPdfApiDoc.operations.POST!;
export const exportPdfHandler = withHttpMethods({
  [HTTPMethod.POST]: withWorkspacePermission(
    exportPdfSpec.roles,
    exportPdfSpec.permission,
    async (req: NextApiRequest, res: NextApiResponse, _user, workspace) => {
      const result = await cocktailsPorting.exportCocktailsPdf(workspace, req.body ?? {});
      if (result.kind === 'error') return res.status(result.status).json(result.body);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="cocktails-export-${Date.now()}.pdf"`);
      res.setHeader('Content-Length', result.buffer.length.toString());
      return res.send(result.buffer);
    },
  ),
});

const importJsonSpec = cocktailsImportJsonApiDoc.operations.POST!;
export const importJsonHandler = withHttpMethods({
  [HTTPMethod.POST]: withWorkspacePermission(
    importJsonSpec.roles,
    importJsonSpec.permission,
    async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
      const result = await cocktailsPorting.importCocktailsJson(workspace, user, req.body ?? {});
      return res.status(result.status).json(result.body);
    },
  ),
});
