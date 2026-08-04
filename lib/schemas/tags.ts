/**
 * Zod schemas + ResourceApiDoc for the Tags resource (v1). Pure module (zod +
 * type-only enums) so scripts/generate-openapi.ts can import it without pulling
 * the Prisma runtime. The legacy endpoint aggregates the distinct tag strings
 * used across cocktails and ingredients, so the DTO is a plain list of strings.
 */
import { z } from '@lib/openapi/zod';
import { WorkspaceIdParam } from '@lib/schemas/common';
import { ApiTags } from '@lib/openapi/tags';
import type { ResourceApiDoc } from '@lib/openapi/types';

/** Public tags DTO — the deduplicated list of tag strings in the workspace. */
export const TagsDtoSchema = z.array(z.string()).openapi('Tags');

export type TagsDto = z.infer<typeof TagsDtoSchema>;

export const tagsCollectionApiDoc = {
  basePath: '/workspaces/{workspaceId}/tags',
  legacyPath: true,
  operations: {
    GET: {
      roles: ['USER'],
      permission: 'COCKTAILS_READ',
      tags: [ApiTags.tagsCore],
      summary: 'List tags',
      description: 'List all distinct tags used across cocktails and ingredients of a workspace.',
      params: WorkspaceIdParam,
      response: TagsDtoSchema,
    },
  },
} satisfies ResourceApiDoc;
