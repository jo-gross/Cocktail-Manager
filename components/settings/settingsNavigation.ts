import { Role } from '@generated/prisma/client';

export type SettingsPageId = 'general' | 'public' | 'languages' | 'translations' | 'recipes' | 'users' | 'apiKeys' | 'data' | 'danger';

export type SettingsNavGroupId = 'workspace' | 'content' | 'access' | 'advanced';

export interface SettingsNavItem {
  id: SettingsPageId;
  group: SettingsNavGroupId;
  /** Path below `/workspaces/[workspaceId]/manage/settings` ('' = overview route). */
  path: string;
  /** Minimum role needed to open the page; `null` = every workspace member. */
  minRole: Role | null;
}

export const SETTINGS_NAV_GROUPS: SettingsNavGroupId[] = ['workspace', 'content', 'access', 'advanced'];

export const SETTINGS_NAV_ITEMS: SettingsNavItem[] = [
  { id: 'general', group: 'workspace', path: '', minRole: Role.ADMIN },
  { id: 'public', group: 'workspace', path: '/public', minRole: Role.ADMIN },
  { id: 'languages', group: 'content', path: '/languages', minRole: Role.ADMIN },
  { id: 'translations', group: 'content', path: '/translations', minRole: null },
  { id: 'recipes', group: 'content', path: '/recipes', minRole: Role.ADMIN },
  { id: 'users', group: 'access', path: '/users', minRole: null },
  { id: 'apiKeys', group: 'access', path: '/api-keys', minRole: Role.ADMIN },
  { id: 'data', group: 'advanced', path: '/data', minRole: Role.ADMIN },
  { id: 'danger', group: 'advanced', path: '/danger', minRole: Role.ADMIN },
];

export function settingsHref(workspaceId: string, page: SettingsPageId): string {
  const item = SETTINGS_NAV_ITEMS.find((entry) => entry.id === page);
  return `/workspaces/${workspaceId}/manage/settings${item?.path ?? ''}`;
}

/** Nav items the current user may open, grouped in display order (empty groups omitted). */
export function visibleSettingsNavGroups(isUserPermitted: (role: Role) => boolean): { group: SettingsNavGroupId; items: SettingsNavItem[] }[] {
  return SETTINGS_NAV_GROUPS.map((group) => ({
    group,
    items: SETTINGS_NAV_ITEMS.filter((item) => item.group === group && (item.minRole == null || isUserPermitted(item.minRole))),
  })).filter((entry) => entry.items.length > 0);
}
