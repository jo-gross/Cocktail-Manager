/**
 * v1 handler wiring for audit logs: validated, typed ctx → shared controller
 * (which returns clean DTOs + PaginationMeta). This endpoint is paginated, so it
 * emits a `{ data, pagination }` envelope. defineApiHandlers/withValidation would
 * otherwise wrap the return value in a plain `{ data }` envelope, so the handler
 * writes the paginated envelope itself and returns undefined (withValidation
 * skips re-sending once res.headersSent / the handler returned nothing).
 */
import { paginated } from '@lib/http/responses';
import { auditLogsCollectionApiDoc } from '@lib/schemas/auditLogs';
import { defineApiHandlers } from '@lib/openapi/apiDoc';
import * as auditLogs from '@lib/api/controllers/auditLogs';

export const collectionHandler = defineApiHandlers(auditLogsCollectionApiDoc.operations, {
  GET: async ({ res, workspace, query }) => {
    const { items, pagination } = await auditLogs.listAuditLogs(workspace, query);
    res.status(200).json(paginated(items, pagination));
  },
});
