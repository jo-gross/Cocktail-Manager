/**
 * v1 handler wiring for Monitor/Signage: validated, typed ctx → shared
 * controllers (clean DTOs). The slide-image endpoint serves binary bytes and is
 * therefore hand-wired (outside defineApiHandlers, which JSON-envelopes).
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import HTTPMethod from 'http-method-enum';
import { Permission, Role } from '@generated/prisma/client';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { fail } from '@lib/http/responses';
import { sendImage } from '@lib/images/imageResponse';
import { defineApiHandlers } from '@lib/openapi/apiDoc';
import {
  SlideItemParams,
  signageApiDoc,
  signageGuestMenuSlideItemApiDoc,
  signageGuestMenuSlidesApiDoc,
  signageKeyApiDoc,
  signageSlideItemApiDoc,
  signageSlidesApiDoc,
} from '@lib/schemas/signage';
import * as signage from '@lib/api/controllers/signage';

export const signageHandler = defineApiHandlers(signageApiDoc.operations, {
  GET: ({ workspace }) => signage.getSignage(workspace),
  PUT: ({ workspace, body }) => signage.updateSignage(workspace, body),
});

export const slidesHandler = defineApiHandlers(signageSlidesApiDoc.operations, {
  POST: ({ workspace, body }) => signage.createSlides(workspace, body),
  PATCH: ({ workspace, body }) => signage.patchSlides(workspace, body),
});

export const slideItemHandler = defineApiHandlers(signageSlideItemApiDoc.operations, {
  DELETE: ({ workspace, params }) => signage.deleteSlide(workspace, params.slideId),
});

export const guestMenuSlidesHandler = defineApiHandlers(signageGuestMenuSlidesApiDoc.operations, {
  POST: ({ workspace, body }) => signage.createGuestMenuSlide(workspace, body),
});

export const guestMenuSlideItemHandler = defineApiHandlers(signageGuestMenuSlideItemApiDoc.operations, {
  PATCH: ({ workspace, params, body }) => signage.updateGuestMenuSlide(workspace, params.slideId, body),
});

export const signageKeyHandler = defineApiHandlers(signageKeyApiDoc.operations, {
  GET: ({ workspace }) => signage.getSignageKey(workspace),
  POST: ({ workspace }) => signage.regenerateSignageKey(workspace),
});

export const slideImageHandler = withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.USER], Permission.MONITOR_READ, async (req: NextApiRequest, res: NextApiResponse, _user, workspace) => {
    const params = SlideItemParams.safeParse(req.query);
    if (!params.success) return res.status(400).json(fail('VALIDATION_ERROR', 'Invalid request params', params.error.issues));

    const image = await signage.getSlideImage(workspace, params.data.slideId);
    if (!image) return res.status(404).json(fail('NOT_FOUND', 'No slide image found'));

    // Image slides are never edited in place (only replaced), so short private caching is safe.
    return sendImage(res, image, 'private, max-age=300');
  }),
});
