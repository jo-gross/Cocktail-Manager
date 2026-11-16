/** Handler wiring for the instance administration of templates (`/api/admin/templates`, master key only). */
import { adminTemplatesAccessApiDoc, adminTemplatesCloneApiDoc, adminTemplatesCollectionApiDoc, adminTemplatesItemApiDoc } from '@lib/schemas/adminTemplates';
import { defineApiHandlers } from '@lib/openapi/apiDoc';
import * as adminTemplates from '@lib/api/controllers/adminTemplates';

export const collectionHandler = defineApiHandlers(adminTemplatesCollectionApiDoc.operations, {
  GET: () => adminTemplates.listAdminTemplates(),
  POST: ({ body }) => adminTemplates.markWorkspaceAsTemplate(body),
});

export const itemHandler = defineApiHandlers(adminTemplatesItemApiDoc.operations, {
  PATCH: ({ params, body }) => adminTemplates.updateAdminTemplate(params.key, body),
  DELETE: ({ params }) => adminTemplates.unmarkAdminTemplate(params.key),
});

export const cloneHandler = defineApiHandlers(adminTemplatesCloneApiDoc.operations, {
  POST: ({ params, body }) => adminTemplates.cloneAdminTemplate(params.key, body),
});

export const accessHandler = defineApiHandlers(adminTemplatesAccessApiDoc.operations, {
  POST: ({ params }) => adminTemplates.createAdminTemplateAccess(params.key),
});
