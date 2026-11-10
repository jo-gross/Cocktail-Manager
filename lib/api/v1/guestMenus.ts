/**
 * v1 handler wiring for guest menus: validated, typed ctx → controllers.
 * The QR endpoint returns SVG and is therefore hand-wired (like signage images).
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import HTTPMethod from 'http-method-enum';
import { Permission, Role } from '@generated/prisma/client';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { withCors } from '@middleware/api/withCors';
import { fail } from '@lib/http/responses';
import { ApiError } from '@lib/http/ApiError';
import { defineApiHandlers } from '@lib/openapi/apiDoc';
import { getRequestApiKeyPermissions } from '@lib/http/requestAuth';
import {
  GuestMenuHtmlExportQuerySchema,
  GuestMenuPdfExportSchema,
  GuestMenuQrQuerySchema,
  GuestMenuTableTentQuerySchema,
  guestMenusActiveExtrasApiDoc,
  guestMenusCollectionApiDoc,
  guestMenusDraftApiDoc,
  guestMenusDuplicateApiDoc,
  guestMenusItemApiDoc,
  guestMenusPreviewApiDoc,
  guestMenusPreviewTokenRegenerateApiDoc,
  guestMenusPublishApiDoc,
  guestMenusReorderApiDoc,
  guestMenusUnpublishApiDoc,
  guestMenuTemplatesBuiltInApiDoc,
  guestMenuTemplatesCollectionApiDoc,
  guestMenuTemplatesItemApiDoc,
} from '@lib/schemas/guestMenus';
import * as guestMenus from '@lib/api/controllers/guestMenus';

export const collectionHandler = defineApiHandlers(guestMenusCollectionApiDoc.operations, {
  GET: ({ workspace, user, req }) => guestMenus.listGuestMenus(workspace, user, getRequestApiKeyPermissions(req)),
  POST: ({ workspace, user, body }) => guestMenus.createGuestMenu(workspace, body, user),
});

export const reorderHandler = defineApiHandlers(guestMenusReorderApiDoc.operations, {
  PUT: ({ workspace, body }) => guestMenus.reorderGuestMenus(workspace, body),
});

export const itemHandler = defineApiHandlers(guestMenusItemApiDoc.operations, {
  GET: ({ workspace, params, user, req }) => guestMenus.getGuestMenu(workspace, params.menuId, user, getRequestApiKeyPermissions(req)),
  PATCH: ({ workspace, user, params, body }) => guestMenus.updateGuestMenu(workspace, params.menuId, body, user),
  DELETE: ({ workspace, user, params }) => guestMenus.deleteGuestMenu(workspace, params.menuId, user),
});

export const draftHandler = defineApiHandlers(guestMenusDraftApiDoc.operations, {
  PUT: ({ workspace, params, body }) => guestMenus.saveGuestMenuDraft(workspace, params.menuId, body),
});

export const publishHandler = defineApiHandlers(guestMenusPublishApiDoc.operations, {
  POST: ({ workspace, user, params }) => guestMenus.publishGuestMenu(workspace, params.menuId, user),
});

export const unpublishHandler = defineApiHandlers(guestMenusUnpublishApiDoc.operations, {
  POST: ({ workspace, user, params }) => guestMenus.unpublishGuestMenu(workspace, params.menuId, user),
});

export const duplicateHandler = defineApiHandlers(guestMenusDuplicateApiDoc.operations, {
  POST: ({ workspace, user, params, body }) => guestMenus.duplicateGuestMenu(workspace, params.menuId, body, user),
});

export const previewTokenRegenerateHandler = defineApiHandlers(guestMenusPreviewTokenRegenerateApiDoc.operations, {
  POST: ({ workspace, user, params }) => guestMenus.regenerateGuestMenuPreviewToken(workspace, params.menuId, user),
});

export const previewHandler = defineApiHandlers(guestMenusPreviewApiDoc.operations, {
  GET: ({ workspace, params, query }) => guestMenus.previewGuestMenu(workspace, params.menuId, query),
});

export const qrHandler = withCors(
  withHttpMethods({
    [HTTPMethod.GET]: withWorkspacePermission([Role.USER], Permission.GUEST_MENUS_READ, async (req: NextApiRequest, res: NextApiResponse, _user, workspace) => {
      const menuId = req.query.menuId as string | undefined;
      const query = GuestMenuQrQuerySchema.safeParse(req.query);
      if (!menuId || !query.success) return res.status(400).json(fail('VALIDATION_ERROR', 'Invalid request query'));
      try {
        const svg = await guestMenus.getGuestMenuQrSvg(workspace, menuId, query.data.target, query.data.margin, req, query.data.code);
        res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
        res.setHeader('Cache-Control', query.data.code ? 'private, no-store' : 'private, max-age=300');
        return res.status(200).send(svg);
      } catch (error) {
        if (error instanceof ApiError) return res.status(error.status).json(fail(error.code, error.message));
        console.error('guest menu qr', error);
        return res.status(500).json(fail('INTERNAL_ERROR', 'Internal error occurred!'));
      }
    }),
  }),
  ['GET'],
);

export const templatesCollectionHandler = defineApiHandlers(guestMenuTemplatesCollectionApiDoc.operations, {
  GET: ({ workspace }) => guestMenus.listGuestMenuTemplates(workspace),
  POST: ({ workspace, body }) => guestMenus.createGuestMenuTemplate(workspace, body),
});

export const templatesBuiltInHandler = defineApiHandlers(guestMenuTemplatesBuiltInApiDoc.operations, {
  GET: () => guestMenus.listBuiltInGuestMenuTemplates(),
});

export const templatesItemHandler = defineApiHandlers(guestMenuTemplatesItemApiDoc.operations, {
  GET: ({ workspace, params }) => guestMenus.getGuestMenuTemplate(workspace, params.templateId),
  PUT: ({ workspace, params, body }) => guestMenus.updateGuestMenuTemplate(workspace, params.templateId, body),
  DELETE: ({ workspace, params }) => guestMenus.deleteGuestMenuTemplate(workspace, params.templateId),
});

/** Sends ApiErrors as JSON envelopes (raw-response handlers). */
function sendError(res: NextApiResponse, error: unknown, context: string) {
  if (error instanceof ApiError) return res.status(error.status).json(fail(error.code, error.message));
  console.error(context, error);
  return res.status(500).json(fail('INTERNAL_ERROR', 'Internal error occurred!'));
}

function sendPdf(res: NextApiResponse, buffer: Buffer, fileName: string) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName.replace(/[^\w.-]/g, '_')}"`);
  res.setHeader('Content-Length', buffer.length.toString());
  res.setHeader('Cache-Control', 'private, no-store');
  return res.status(200).send(buffer);
}

export const exportPdfHandler = withCors(
  withHttpMethods({
    [HTTPMethod.POST]: withWorkspacePermission(
      [Role.USER],
      Permission.GUEST_MENUS_READ,
      async (req: NextApiRequest, res: NextApiResponse, _user, workspace) => {
        const menuId = req.query.menuId as string | undefined;
        const body = GuestMenuPdfExportSchema.safeParse(req.body ?? {});
        if (!menuId || !body.success) return res.status(400).json(fail('VALIDATION_ERROR', 'Invalid request body'));
        try {
          const { buffer, fileName } = await guestMenus.exportGuestMenuPdf(workspace, menuId, body.data, req);
          return sendPdf(res, buffer, fileName);
        } catch (error) {
          return sendError(res, error, 'guest menu pdf');
        }
      },
    ),
  }),
  ['POST'],
);

export const exportHtmlHandler = withCors(
  withHttpMethods({
    [HTTPMethod.GET]: withWorkspacePermission([Role.USER], Permission.GUEST_MENUS_READ, async (req: NextApiRequest, res: NextApiResponse, _user, workspace) => {
      const menuId = req.query.menuId as string | undefined;
      const query = GuestMenuHtmlExportQuerySchema.safeParse(req.query);
      if (!menuId || !query.success) return res.status(400).json(fail('VALIDATION_ERROR', 'Invalid request query'));
      try {
        const { html } = await guestMenus.getGuestMenuPrintHtml(workspace, menuId, {
          source: query.data.source ?? 'draft',
          locale: query.data.locale,
          paper: query.data.paper,
          showQrCode: query.data.showQrCode === undefined ? undefined : query.data.showQrCode === 'true',
          req,
        });
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'private, no-store');
        // Static document: no scripts, inline styles/fonts/images only.
        res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; frame-ancestors 'self'");
        return res.status(200).send(html);
      } catch (error) {
        return sendError(res, error, 'guest menu html');
      }
    }),
  }),
  ['GET'],
);

export const tableTentHandler = withCors(
  withHttpMethods({
    [HTTPMethod.GET]: withWorkspacePermission([Role.USER], Permission.GUEST_MENUS_READ, async (req: NextApiRequest, res: NextApiResponse, _user, workspace) => {
      const menuId = req.query.menuId as string | undefined;
      const query = GuestMenuTableTentQuerySchema.safeParse(req.query);
      if (!menuId || !query.success) return res.status(400).json(fail('VALIDATION_ERROR', 'Invalid request query'));
      try {
        const { buffer, fileName } = await guestMenus.exportGuestMenuTableTentPdf(workspace, menuId, query.data, req);
        return sendPdf(res, buffer, fileName);
      } catch (error) {
        return sendError(res, error, 'guest menu table tent');
      }
    }),
  }),
  ['GET'],
);

export const activeExtrasHandler = defineApiHandlers(guestMenusActiveExtrasApiDoc.operations, {
  GET: ({ workspace, query }) => guestMenus.getActiveGuestMenuExtras(workspace, query.cardId),
});
