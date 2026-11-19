import { describe, expect, it } from 'vitest';
import { Role } from '@generated/prisma/client';
import { decidePagePermission, type PagePermissionState } from '../withPagePermission';

const ROLE_RANK: Record<Role, number> = { USER: 0, MANAGER: 1, ADMIN: 2, OWNER: 3 };
const permittedAs = (role: Role | undefined) => (required: Role) => role != undefined && ROLE_RANK[role] >= ROLE_RANK[required];

const loaded = (role: Role | undefined, overrides: Partial<PagePermissionState> = {}): PagePermissionState => ({
  workspaceId: 'ws-new',
  userLoaded: true,
  workspaceRefreshing: false,
  loadedWorkspaceId: 'ws-new',
  isUserPermitted: permittedAs(role),
  ...overrides,
});

describe('decidePagePermission', () => {
  it('waits while the workspace from the URL is not loaded yet (new workspace → setup)', () => {
    // First render after router.push: AuthBoundary has not started loading, the context has no workspace.
    expect(decidePagePermission([Role.ADMIN], loaded(undefined, { loadedWorkspaceId: undefined }))).toBe('wait');
  });

  it('does not judge the page by the previous workspace', () => {
    // Coming from a workspace where the user is only USER: that membership must not deny the new one.
    expect(decidePagePermission([Role.ADMIN], loaded(Role.USER, { loadedWorkspaceId: 'ws-old' }))).toBe('wait');
  });

  it('waits for the user, the URL and a running refresh', () => {
    expect(decidePagePermission([Role.ADMIN], loaded(Role.OWNER, { workspaceId: undefined }))).toBe('wait');
    expect(decidePagePermission([Role.ADMIN], loaded(Role.OWNER, { userLoaded: false }))).toBe('wait');
    expect(decidePagePermission([Role.ADMIN], loaded(Role.OWNER, { workspaceRefreshing: true }))).toBe('wait');
  });

  it('allows the owner once the new workspace is loaded', () => {
    expect(decidePagePermission([Role.ADMIN], loaded(Role.OWNER))).toBe('allow');
  });

  it('denies a role below the minimum once the workspace is loaded', () => {
    expect(decidePagePermission([Role.ADMIN], loaded(Role.MANAGER))).toBe('deny');
    expect(decidePagePermission([Role.MANAGER], loaded(Role.USER))).toBe('deny');
    expect(decidePagePermission([Role.MANAGER], loaded(Role.MANAGER))).toBe('allow');
    expect(decidePagePermission([Role.USER], loaded(Role.USER))).toBe('allow');
  });

  it('accepts an array query value', () => {
    expect(decidePagePermission([Role.ADMIN], loaded(Role.ADMIN, { workspaceId: ['ws-new'] }))).toBe('allow');
  });
});
