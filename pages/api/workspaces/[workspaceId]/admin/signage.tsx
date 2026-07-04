import HTTPMethod from 'http-method-enum';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { $Enums, Permission, Role } from '@generated/prisma/client';
import prisma from '../../../../../prisma/prisma';
import { NextApiRequest, NextApiResponse } from 'next';
import { SignageSettingsUpdatePayload } from '@lib/signage/types';
import { parseRequestBody } from '@lib/signage/parseRequestBody';
import MonitorFormat = $Enums.MonitorFormat;

async function updateSignageFormatSettings(workspaceId: string, format: MonitorFormat, data: SignageSettingsUpdatePayload['landscape']) {
  if (!data) {
    return;
  }

  const existing = await prisma.signage.findUnique({
    where: {
      workspaceId_format: {
        workspaceId,
        format,
      },
    },
  });

  const mirrorSourceFormat = data.mirrorSourceFormat ?? null;

  const signageData = {
    slideDurationSeconds: data.slideDurationSeconds,
    backgroundColor: data.backgroundColor === '' || data.backgroundColor === null ? null : data.backgroundColor,
    backgroundMode: data.backgroundMode ?? 'COLOR',
    mirrorSourceFormat,
  };

  if (existing || data.slides.length > 0 || mirrorSourceFormat) {
    await prisma.signage.upsert({
      where: {
        workspaceId_format: {
          workspaceId,
          format,
        },
      },
      update: signageData,
      create: {
        workspaceId,
        format,
        ...signageData,
      },
    });
  }

  if (mirrorSourceFormat) {
    await prisma.signageSlide.updateMany({
      where: {
        workspaceId,
        format,
      },
      data: {
        enabled: false,
      },
    });
  } else if (existing?.mirrorSourceFormat) {
    const formatSlides = await prisma.signageSlide.findMany({
      where: {
        workspaceId,
        format,
      },
    });

    if (formatSlides.length === 1 && !formatSlides[0].enabled) {
      await prisma.signageSlide.update({
        where: { id: formatSlides[0].id },
        data: { enabled: true },
      });
    }
  }

  await Promise.all(
    data.slides.map((slide) =>
      prisma.signageSlide.updateMany({
        where: {
          id: slide.id,
          workspaceId,
          format,
        },
        data: {
          order: slide.order,
        },
      }),
    ),
  );
}

export default withHttpMethods({
  [HTTPMethod.GET]: withWorkspacePermission([Role.USER], Permission.MONITOR_READ, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    const signages = await prisma.signage.findMany({
      where: {
        workspaceId: workspace.id,
      },
    });

    return res.status(200).json({ content: signages });
  }),
  [HTTPMethod.PUT]: withWorkspacePermission([Role.MANAGER], Permission.MONITOR_UPDATE, async (req: NextApiRequest, res: NextApiResponse, user, workspace) => {
    try {
      const body = parseRequestBody<SignageSettingsUpdatePayload>(req.body);

      await prisma.$transaction(async () => {
        if (body.landscape) {
          await updateSignageFormatSettings(workspace.id, MonitorFormat.LANDSCAPE, body.landscape);
        }
        if (body.portrait) {
          await updateSignageFormatSettings(workspace.id, MonitorFormat.PORTRAIT, body.portrait);
        }
      });

      return res.status(200).json({ message: 'Signage settings updated' });
    } catch (error) {
      console.error('signage PUT', error);
      const message = error instanceof Error ? error.message : 'Failed to update signage settings';
      return res.status(500).json({ message });
    }
  }),
});
