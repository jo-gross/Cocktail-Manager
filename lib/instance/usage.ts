/**
 * Maps the grouped count queries of one inventory page to per-workspace usage, owner and activity. Pure module.
 *
 * Definitions (the same the control plane derives from the legacy routes, where those exist):
 * - cocktails: cocktails that are not archived (`/cocktails` list filtered by `!isArchived`)
 * - members: workspace members (`/users` list)
 * - calculations: all calculations (`/calculations` list)
 * - guestMenusPublished: guest menus with a published version (`isPublished` of the `/guest-menus` list)
 * - signageScreens: configured monitor formats (one `Signage` row per format); no legacy equivalent
 * - apiKeys: workspace API keys that are neither revoked nor expired; no legacy equivalent
 */
import type { InstanceUsageCounts } from '@lib/schemas/instance';

export type UsageKey = keyof InstanceUsageCounts;

/** Result row of a Prisma `groupBy({ by: ['workspaceId'], _count: { _all: true } })`. */
export interface CountGroup {
  workspaceId: string;
  _count: { _all: number };
}

export type UsageGroups = Record<UsageKey, CountGroup[]>;

export function emptyUsage(): InstanceUsageCounts {
  return { cocktails: 0, members: 0, calculations: 0, guestMenusPublished: 0, signageScreens: 0, apiKeys: 0 };
}

/** Usage per requested workspace id; workspaces without rows in a group count 0. */
export function mapUsage(workspaceIds: readonly string[], groups: UsageGroups): Map<string, InstanceUsageCounts> {
  const usage = new Map(workspaceIds.map((id) => [id, emptyUsage()]));
  for (const key of Object.keys(groups) as UsageKey[]) {
    for (const group of groups[key]) {
      const counts = usage.get(group.workspaceId);
      if (counts) counts[key] = group._count._all;
    }
  }
  return usage;
}

/** Latest of the given timestamps per workspace (e.g. newest audit log entry and newest member visit). */
export function latestPerWorkspace(...sources: Array<Array<{ workspaceId: string; at: Date | null }>>): Map<string, Date> {
  const latest = new Map<string, Date>();
  for (const source of sources) {
    for (const { workspaceId, at } of source) {
      if (!at) continue;
      const current = latest.get(workspaceId);
      if (!current || at > current) latest.set(workspaceId, at);
    }
  }
  return latest;
}

export interface OwnerCandidate {
  workspaceId: string;
  user: { id: string; email: string | null; name: string | null; createdAt: Date };
}

/** One owner per workspace: the longest-registered one (ties by user id), so the choice is stable. */
export function pickOwners(candidates: readonly OwnerCandidate[]): Map<string, { id: string; email: string; name: string }> {
  const chosen = new Map<string, OwnerCandidate['user']>();
  for (const { workspaceId, user } of candidates) {
    const current = chosen.get(workspaceId);
    const earlier = !current || user.createdAt < current.createdAt || (user.createdAt.getTime() === current.createdAt.getTime() && user.id < current.id);
    if (earlier) chosen.set(workspaceId, user);
  }
  return new Map([...chosen].map(([workspaceId, user]) => [workspaceId, { id: user.id, email: user.email ?? '', name: user.name ?? '' }]));
}
