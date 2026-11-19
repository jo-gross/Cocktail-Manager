import { apiV1Fetch } from '@lib/network/apiV1';
import type { AnnouncementDto } from '@lib/schemas/announcements';

/**
 * Active announcements of the hosting provider: for a workspace, or without one those for all workspaces (workspace
 * overview). Throws `ApiV1RequestError`; the banner ignores failures.
 */
export function fetchAnnouncements(workspaceId: string | null, signal?: AbortSignal): Promise<AnnouncementDto[]> {
  const path = workspaceId === null ? '/api/v1/announcements' : `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/announcements`;
  return apiV1Fetch<AnnouncementDto[]>(path, { signal });
}
