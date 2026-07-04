import { withHttpMethods } from '@middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';
import prisma from '../../../prisma/prisma';
import { filterSlidesForDisplay } from '@lib/signage/isSlideActiveNow';
import { mapSignageFormatView, mapSignageSlide, resolveSignageSlides } from '@lib/signage/signageApiHelpers';

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
        },
      },
    });

    const mappedSignages = signages.map((signage) => ({
      workspaceId: signage.workspaceId,
      format: signage.format,
      backgroundColor: signage.backgroundColor,
      backgroundMode: signage.backgroundMode,
      slideDurationSeconds: signage.slideDurationSeconds,
      mirrorSourceFormat: signage.mirrorSourceFormat,
      slides: signage.slides.map(mapSignageSlide),
    }));

    const content = mappedSignages.map((signage) => {
      const ownSlides = signage.slides;
      const displaySlides = includeInactive ? ownSlides : filterSlidesForDisplay(resolveSignageSlides(mappedSignages, signage.format));

      return mapSignageFormatView({
        ...signage,
        slides: displaySlides,
      });
    });

    if (format === undefined) {
      return res.status(200).json({ content });
    }

    res.status(200).json({ content: content.find((s) => s.format === format) ?? content[0] });
  },
});
