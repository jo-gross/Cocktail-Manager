/**
 * Shared building blocks for v1 request/response schemas.
 * JSON serializes Prisma DateTime as ISO strings, so responses use DateTimeString.
 */
import { z } from '@lib/openapi/zod';

export const WorkspaceIdParam = z.object({
  workspaceId: z.string().openapi({ description: 'Workspace ID', example: 'ckw0a1b2c3d4e5f6g7h8' }),
});

export const DateTimeString = z.string().openapi({ format: 'date-time', example: '2026-07-04T12:00:00.000Z', description: 'ISO 8601 timestamp' });

export const PaginationMeta = z
  .object({
    total: z.number().int().openapi({ description: 'Total matching items' }),
    page: z.number().int(),
    totalPages: z.number().int(),
    list_total: z.number().int().openapi({ description: 'Items in this page' }),
  })
  .openapi('PaginationMeta');

export const ErrorResponse = z
  .object({
    error: z.object({
      code: z.string().openapi({ example: 'VALIDATION_ERROR' }),
      message: z.string(),
      issues: z.unknown().optional(),
    }),
  })
  .openapi('ErrorResponse');

/** Result of a delete / deleteMany operation: how many records were removed. */
export const DeletionResult = z
  .object({
    count: z.number().int().openapi({ description: 'Number of records deleted.' }),
  })
  .openapi('DeletionResult');

export type DeletionResult = z.infer<typeof DeletionResult>;

/** Wrap a payload schema in the standard { data } envelope. */
export const dataEnvelope = <T extends z.ZodTypeAny>(schema: T) => z.object({ data: schema });

/** Wrap a payload schema in the standard { data, pagination } envelope. */
export const paginatedEnvelope = <T extends z.ZodTypeAny>(schema: T) => z.object({ data: schema, pagination: PaginationMeta });
