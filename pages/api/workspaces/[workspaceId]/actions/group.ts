import { withHttpMethods } from '../../../../../middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';
import { withWorkspacePermission } from '../../../../../middleware/api/authenticationMiddleware';
import { Role } from '@prisma/client';
import prisma from '../../../../../lib/prisma';

export default withHttpMethods({
  [HTTPMethod.PUT]: withWorkspacePermission([Role.ADMIN], async (req, res, user, workspace) => {
    const { actionGroup, translations } = req.body;

    const existingTranslations = await prisma.workspaceSetting.findFirst({ where: { workspaceId: workspace.id, setting: 'translations' } });
    const parsedExistingTranslations = JSON.parse(existingTranslations?.value ?? '{}');

    for (const lang in translations) {
      parsedExistingTranslations[lang][actionGroup] = translations[lang];
    }

    const response = await prisma.workspaceSetting.update({
      where: {
        workspaceId_setting: {
          setting: 'translations',
          workspaceId: workspace.id,
        },
      },
      data: { value: JSON.stringify(parsedExistingTranslations) },
    });

    return res.json({ data: response });
  }),
});
