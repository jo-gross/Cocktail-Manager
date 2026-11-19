/**
 * Handler wiring of the instance API (`/api/v1/instance/**`, master key only). The workspace inventory is
 * cursor-paginated, so its handler writes the `{ data, pagination: { nextCursor } }` envelope itself.
 */
import { cursorPaginated } from '@lib/http/responses';
import { instanceApiDoc, instanceUsersCollectionApiDoc, instanceWorkspacesCollectionApiDoc, instanceWorkspacesItemApiDoc } from '@lib/schemas/instance';
import { defineApiHandlers } from '@lib/openapi/apiDoc';
import * as instance from '@lib/api/controllers/instance';

export const instanceHandler = defineApiHandlers(instanceApiDoc.operations, {
  GET: () => instance.getInstanceInfo(),
});

export const workspacesCollectionHandler = defineApiHandlers(instanceWorkspacesCollectionApiDoc.operations, {
  GET: async ({ res, query }) => {
    const { items, nextCursor } = await instance.listInstanceWorkspaces(query);
    res.status(200).json(cursorPaginated(items, nextCursor));
  },
});

export const workspacesItemHandler = defineApiHandlers(instanceWorkspacesItemApiDoc.operations, {
  GET: ({ params }) => instance.getInstanceWorkspace(params.id),
});

export const usersCollectionHandler = defineApiHandlers(instanceUsersCollectionApiDoc.operations, {
  GET: ({ query }) => instance.searchInstanceUsers(query),
});
