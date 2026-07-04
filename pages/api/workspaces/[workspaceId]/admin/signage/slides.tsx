import HTTPMethod from 'http-method-enum';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { $Enums, Permission, Role } from '@generated/prisma/client';
import prisma from '../../../../../../prisma/prisma';
import { NextApiRequest, NextApiResponse } from 'next';
import { SignageSlideCreatePayload, SignageSlidePatchPayload } from '@lib/signage/types';
import { ensureSignageContainer, mapSignageSlide } from '@lib/signage/signageApiHelpers';
import { parseRequestBody } from '@lib/signage/parseRequestBody';
import { validateExclusiveOverlap } from '@lib/signage/validateExclusiveOverlap';
import MonitorFormat = $Enums.MonitorFormat;

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '25mb',
    },
  },
};

function parseDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  return new Date(value);
}

export default withHttpMethods({
  [HTTPMethod.POST]: withWorkspacePermission([Role.MANAGER], Permission.MONITOR_UPDATE, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const body = parseRequestBody<SignageSlideCreatePayload>(req.body);

    if (!body.format || !Array.isArray(body.slides) || body.slides.length === 0) {
      return res.status(400).json({ message: 'Invalid slide upload payload' });
    }

    const format = body.format as MonitorFormat;

    const createdSlides = await prisma.$transaction(async (tx) => {
      await ensureSignageContainer(tx, workspace.id, format);

      const maxOrderSlide = await tx.signageSlide.findFirst({
        where: {
          workspaceId: workspace.id,
          format,
        },
        orderBy: {
          order: 'desc',
        },
      });

      let nextOrder = (maxOrderSlide?.order ?? -1) + 1;
      const created = [];

      for (const content of body.slides) {
        const slide = await tx.signageSlide.create({
          data: {
            workspaceId: workspace.id,
            format,
            content,
            order: nextOrder,
          },
        });
        created.push(slide);
        nextOrder += 1;
      }

      return created;
    });

    res.status(201).json({
      slides: createdSlides.map(mapSignageSlide),
    });
  }),

  [HTTPMethod.PATCH]: withWorkspacePermission([Role.MANAGER], Permission.MONITOR_UPDATE, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const body = parseRequestBody<SignageSlidePatchPayload>(req.body);

    if (!Array.isArray(body.slideIds) || body.slideIds.length === 0) {
      return res.status(400).json({ message: 'No slide ids provided' });
    }

    const existingSlides = await prisma.signageSlide.findMany({
      where: {
        workspaceId: workspace.id,
        id: {
          in: body.slideIds,
        },
      },
    });

    if (existingSlides.length === 0) {
      return res.status(404).json({ message: 'Slides not found' });
    }

    const format = existingSlides[0].format;
    const allFormatSlides = await prisma.signageSlide.findMany({
      where: {
        workspaceId: workspace.id,
        format,
      },
      orderBy: {
        order: 'asc',
      },
    });

    const scheduleFieldsChanging = body.dateExclusive !== undefined || body.validFrom !== undefined || body.validTo !== undefined || body.enabled !== undefined;

    if (scheduleFieldsChanging) {
      const validation = validateExclusiveOverlap(
        allFormatSlides.map((slide) => ({
          id: slide.id,
          dateExclusive: slide.dateExclusive,
          enabled: slide.enabled,
          validFrom: slide.validFrom,
          validTo: slide.validTo,
          weekdays: slide.weekdays,
        })),
        body.slideIds,
        {
          dateExclusive: body.dateExclusive,
          enabled: body.enabled,
          validFrom: body.validFrom,
          validTo: body.validTo,
        },
      );

      if (!validation.valid) {
        return res.status(409).json({
          message: 'Exklusive Zeiträume überschneiden sich mit bestehenden exklusiven Karten',
          conflicts: validation.conflicts,
        });
      }
    }

    const data: {
      enabled?: boolean;
      weekdays?: number[];
      validFrom?: Date | null;
      validTo?: Date | null;
      dateExclusive?: boolean;
    } = {};

    if (body.enabled !== undefined) {
      data.enabled = body.enabled;
    }
    if (body.weekdays !== undefined) {
      data.weekdays = body.weekdays;
    }
    if (body.validFrom !== undefined) {
      data.validFrom = parseDate(body.validFrom);
    }
    if (body.validTo !== undefined) {
      data.validTo = parseDate(body.validTo);
    }
    if (body.dateExclusive !== undefined) {
      data.dateExclusive = body.dateExclusive;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: 'No update fields provided' });
    }

    await prisma.signageSlide.updateMany({
      where: {
        workspaceId: workspace.id,
        id: {
          in: body.slideIds,
        },
      },
      data,
    });

    const slides = await prisma.signageSlide.findMany({
      where: {
        workspaceId: workspace.id,
        id: {
          in: body.slideIds,
        },
      },
      orderBy: {
        order: 'asc',
      },
    });

    res.status(200).json({
      slides: slides.map(mapSignageSlide),
    });
  }),
});
