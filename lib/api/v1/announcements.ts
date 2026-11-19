/** Handler wiring of the announcements: the push of the instance API (master key only) and the reads of the banner (session only). */
import { announcementsCollectionApiDoc, instanceAnnouncementsApiDoc, workspaceAnnouncementsCollectionApiDoc } from '@lib/schemas/announcements';
import { defineApiHandlers } from '@lib/openapi/apiDoc';
import * as announcements from '@lib/api/controllers/announcements';

export const instanceAnnouncementsHandler = defineApiHandlers(instanceAnnouncementsApiDoc.operations, {
  PUT: ({ req, body }) => announcements.replaceAnnouncements(req.headers, body),
});

export const collectionHandler = defineApiHandlers(announcementsCollectionApiDoc.operations, {
  GET: () => announcements.listActiveAnnouncements(null),
});

export const workspaceCollectionHandler = defineApiHandlers(workspaceAnnouncementsCollectionApiDoc.operations, {
  GET: ({ workspace }) => announcements.listActiveAnnouncements(workspace.id),
});
