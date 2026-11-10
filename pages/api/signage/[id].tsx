import { withHttpMethods } from '@middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';
import prisma from '../../../prisma/prisma';
import { filterSlidesForDisplay } from '@lib/signage/isSlideActiveNow';
import { mapSignageFormatView, mapSignageSlide, resolveSignageSlides } from '@lib/signage/signageApiHelpers';
import { createSignageAccessToken } from '@lib/guest-menu/access';
import { isValidSignageKey } from '@lib/signage/signageKey';
import type { SignageSlideView } from '@lib/signage/types';

export default withHttpMethods({
  [HTTPMethod.GET]: async (req, res) => {
    const { id } = req.query;
    const { format } = req.query;
    const includeInactive = req.query.includeInactive === 'true';

    const signages = await prisma.signage.findMany({
      where: {
        workspaceId: id as string,
      },
      include: {
        slides: {
          orderBy: {
            order: 'asc',
          },
          include: { guestMenu: { select: { slug: true } } },
        },
      },
    });

    // Protected guest menus: only monitors with the workspace's monitor key (`?key=`) get
    // signed access tokens (menu + code version, ~24 h). Without key those slides are skipped.
    const hasMenuSlides = signages.some((signage) => signage.slides.some((slide) => slide.type === 'GUEST_MENU'));
    const hasValidKey =
      hasMenuSlides &&
      typeof req.query.key === 'string' &&
      isValidSignageKey(req.query.key, (await prisma.workspace.findUnique({ where: { id: id as string }, select: { signageKey: true } }))?.signageKey);
    const protectedMenus = hasValidKey
      ? await prisma.guestMenu.findMany({
          where: { workspaceId: id as string, enabled: true, accessCodeHash: { not: null } },
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
      const ownSlides = signage.slides;
      const displaySlides = includeInactive ? ownSlides : filterSlidesForDisplay(resolveSignageSlides(mappedSignages, signage.format));

      return mapSignageFormatView({
        ...signage,
        slides: displaySlides,
      });
    });

    // Access tokens must not end up in shared caches.
    if (tokens.size > 0) res.setHeader('Cache-Control', 'private, no-store');

    if (format === undefined) {
      return res.status(200).json({ content });
    }

    res.status(200).json({ content: content.find((s) => s.format === format) ?? content[0] });
  },
});
