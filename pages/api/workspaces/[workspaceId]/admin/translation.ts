import { withHttpMethods } from '@middleware/api/handleMethods';
import HTTPMethod from 'http-method-enum';
import { withWorkspacePermission } from '@middleware/api/authenticationMiddleware';
import { Role } from '@generated/prisma/client';
import prisma from '../../../../../prisma/prisma';

export async function updateTranslation(workspaceId: string, key: string, translations: { [lang: string]: string }) {
  const existingTranslations = await prisma.workspaceSetting.findFirst({ where: { workspaceId: workspaceId, setting: 'translations' } });
  const parsedExistingTranslations = JSON.parse(existingTranslations?.value ?? '{}');

  for (const lang in translations) {
    parsedExistingTranslations[lang][key] = translations[lang];
  }

  return prisma.workspaceSetting.update({
    where: {
      workspaceId_setting: {
        setting: 'translations',
        workspaceId: workspaceId,
      },
    },
    data: { value: JSON.stringify(parsedExistingTranslations) },
  });
}

export default withHttpMethods({
  [HTTPMethod.PUT]: withWorkspacePermission([Role.ADMIN], async (req, res, user, workspace) => {
    const { key, translations } = req.body;

    const response = await updateTranslation(workspace.id, key, translations);

    return res.json({ data: response });
  }),
});
