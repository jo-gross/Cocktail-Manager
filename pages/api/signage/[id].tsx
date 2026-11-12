/**
 * Public monitor feed (no auth): `GET /api/signage/{workspaceId}?format=&key=&includeInactive=true`.
 *
 * - Without `includeInactive`, only the slides that are active right now (schedule, exclusive
 *   slides, mirrored formats) are returned.
 * - `includeInactive=true` returns every slide incl. disabled/scheduled ones and requires the
 *   workspace's monitor key (`key`); otherwise 403.
 * - Signage access tokens for PIN-protected guest menus are only issued with a valid key.
 * - Rate limited per IP (token bucket, 429 + Retry-After).
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import HTTPMethod from 'http-method-enum';
import { z } from 'zod';
import { withHttpMethods } from '@middleware/api/handleMethods';
import prisma from '../../../prisma/prisma';
import { applyRateLimit, TokenBucketRateLimiter } from '@lib/http/rateLimit';
import { sendFail } from '@lib/http/responses';
import { filterSlidesForDisplay } from '@lib/signage/isSlideActiveNow';
import { mapSignageFormatView, mapSignageSlide, resolveSignageSlides } from '@lib/signage/signageApiHelpers';
import { createSignageAccessToken } from '@lib/guest-menu/access';
import { isValidSignageKey } from '@lib/signage/signageKey';
import type { SignageSlideView } from '@lib/signage/types';

// Monitors poll every few minutes; the burst covers several monitors behind one NAT address.
const limiter = new TokenBucketRateLimiter({ capacity: 60, refillPerSecond: 1 });

const QuerySchema = z.object({
  id: z.string().min(1).max(128),
  format: z.enum(['LANDSCAPE', 'PORTRAIT']).optional(),
  includeInactive: z.enum(['true', 'false']).optional(),
  key: z.string().max(256).optional(),
});

async function getSignage(req: NextApiRequest, res: NextApiResponse) {
  if (!applyRateLimit(limiter, req, res, 'signage')) return;

  const query = QuerySchema.safeParse(req.query);
  if (!query.success) return sendFail(res, 400, 'VALIDATION_ERROR', 'Invalid request query', query.error.issues);
  const { id, format, key } = query.data;
  const includeInactive = query.data.includeInactive === 'true';

  let keyValid: boolean | undefined;
  const hasValidKey = async () => {
    if (keyValid === undefined) {
      keyValid = key !== undefined && isValidSignageKey(key, (await prisma.workspace.findUnique({ where: { id }, select: { signageKey: true } }))?.signageKey);
    }
    return keyValid;
  };

  // Disabled / not yet scheduled slides are not public: only monitors (and the admin preview) with the key see them.
  if (includeInactive && !(await hasValidKey())) {
    return sendFail(res, 403, 'FORBIDDEN', 'includeInactive requires a valid monitor key');
  }

  const signages = await prisma.signage.findMany({
    where: { workspaceId: id },
    include: {
      slides: {
        orderBy: { order: 'asc' },
        include: { guestMenu: { select: { slug: true } } },
      },
    },
  });

  // Protected guest menus: only monitors with the workspace's monitor key (`?key=`) get
  // signed access tokens (menu + code version, ~24 h). Without key those slides are skipped.
  const hasMenuSlides = signages.some((signage) => signage.slides.some((slide) => slide.type === 'GUEST_MENU'));
  const protectedMenus =
    hasMenuSlides && (await hasValidKey())
      ? await prisma.guestMenu.findMany({
          where: { workspaceId: id, enabled: true, accessCodeHash: { not: null } },
          select: { id: true, accessCodeHash: true, accessCodeVersion: true },
        })
      : [];
  const tokens = new Map(protectedMenus.map((menu) => [menu.id, createSignageAccessToken(menu)]));
  const withAccessTokens = (slide: SignageSlideView): SignageSlideView => {
    if (slide.type !== 'GUEST_MENU' || tokens.size === 0) return slide;
    const menuTokens = slide.guestMenuId ? [tokens.get(slide.guestMenuId)].filter((token): token is string => !!token) : [...tokens.values()];
    return menuTokens.length > 0 ? { ...slide, guestMenuAccessTokens: menuTokens } : slide;
  };

  const mappedSignages = signages.map((signage) => ({
    workspaceId: signage.workspaceId,
    format: signage.format,
    backgroundColor: signage.backgroundColor,
    backgroundMode: signage.backgroundMode,
    slideDurationSeconds: signage.slideDurationSeconds,
    mirrorSourceFormat: signage.mirrorSourceFormat,
    slides: signage.slides.map((slide) => withAccessTokens(mapSignageSlide(slide))),
  }));

  const content = mappedSignages.map((signage) => {
    const displaySlides = includeInactive ? signage.slides : filterSlidesForDisplay(resolveSignageSlides(mappedSignages, signage.format));
    return mapSignageFormatView({ ...signage, slides: displaySlides });
  });

  // Access tokens and inactive slides must not end up in shared caches.
  if (tokens.size > 0 || includeInactive) res.setHeader('Cache-Control', 'private, no-store');

  if (format === undefined) {
    return res.status(200).json({ content });
  }

  return res.status(200).json({ content: content.find((s) => s.format === format) ?? content[0] });
}

export default withHttpMethods({
  [HTTPMethod.GET]: getSignage,
});
