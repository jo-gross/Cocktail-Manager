import { describe, expect, it } from 'vitest';
import { emptyUsage, latestPerWorkspace, mapUsage, pickOwners, type UsageGroups } from '@lib/instance/usage';

const group = (workspaceId: string, count: number) => ({ workspaceId, _count: { _all: count } });

describe('mapUsage', () => {
  it('maps every grouped count to its workspace and key', () => {
    const groups: UsageGroups = {
      cocktails: [group('a', 3), group('b', 1)],
      members: [group('a', 2)],
      calculations: [group('b', 4)],
      guestMenusPublished: [group('a', 1)],
      signageScreens: [group('a', 2)],
      apiKeys: [group('b', 5)],
    };
    const usage = mapUsage(['a', 'b'], groups);
    expect(usage.get('a')).toEqual({ cocktails: 3, members: 2, calculations: 0, guestMenusPublished: 1, signageScreens: 2, apiKeys: 0 });
    expect(usage.get('b')).toEqual({ cocktails: 1, members: 0, calculations: 4, guestMenusPublished: 0, signageScreens: 0, apiKeys: 5 });
  });

  it('counts 0 for workspaces without rows and ignores rows of other workspaces', () => {
    const groups: UsageGroups = {
      cocktails: [group('other', 9)],
      members: [],
      calculations: [],
      guestMenusPublished: [],
      signageScreens: [],
      apiKeys: [],
    };
    const usage = mapUsage(['a'], groups);
    expect(usage.get('a')).toEqual(emptyUsage());
    expect(usage.has('other')).toBe(false);
  });
});

describe('latestPerWorkspace', () => {
  it('takes the newest timestamp over all sources and skips nulls', () => {
    const early = new Date('2026-01-01T00:00:00Z');
    const late = new Date('2026-02-01T00:00:00Z');
    const latest = latestPerWorkspace(
      [
        { workspaceId: 'a', at: early },
        { workspaceId: 'b', at: null },
      ],
      [
        { workspaceId: 'a', at: late },
        { workspaceId: 'c', at: early },
      ],
    );
    expect(latest.get('a')).toEqual(late);
    expect(latest.has('b')).toBe(false);
    expect(latest.get('c')).toEqual(early);
  });
});

describe('pickOwners', () => {
  it('picks the longest-registered owner per workspace, ties by id, and maps missing email/name to empty strings', () => {
    const t1 = new Date('2026-01-01T00:00:00Z');
    const t2 = new Date('2026-02-01T00:00:00Z');
    const owners = pickOwners([
      { workspaceId: 'a', user: { id: 'u2', email: 'two@test', name: 'Two', createdAt: t2 } },
      { workspaceId: 'a', user: { id: 'u1', email: 'one@test', name: 'One', createdAt: t1 } },
      { workspaceId: 'b', user: { id: 'u4', email: null, name: null, createdAt: t1 } },
      { workspaceId: 'b', user: { id: 'u3', email: 'three@test', name: null, createdAt: t1 } },
    ]);
    expect(owners.get('a')).toEqual({ id: 'u1', email: 'one@test', name: 'One' });
    expect(owners.get('b')).toEqual({ id: 'u3', email: 'three@test', name: '' });
  });
});
