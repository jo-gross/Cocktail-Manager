import { describe, expect, it } from 'vitest';
import { offlineCacheEntriesForMutation } from '../invalidation';

describe('offlineCacheEntriesForMutation', () => {
  it('drops the detail and summary entries of a mutated cocktail', () => {
    expect(offlineCacheEntriesForMutation('/api/v1/workspaces/ws1/cocktails/c1')).toEqual([
      { storeName: 'cocktails', workspaceId: 'ws1', resourceId: 'c1-full' },
      { storeName: 'cocktails', workspaceId: 'ws1', resourceId: 'c1' },
    ]);
  });

  it('covers cocktail sub-resources such as the availability toggle', () => {
    expect(offlineCacheEntriesForMutation('/api/v1/workspaces/ws1/cocktails/c1/availability')).toEqual([
      { storeName: 'cocktails', workspaceId: 'ws1', resourceId: 'c1-full' },
      { storeName: 'cocktails', workspaceId: 'ws1', resourceId: 'c1' },
    ]);
  });

  it('drops a mutated card', () => {
    expect(offlineCacheEntriesForMutation('/api/v1/workspaces/ws1/cards/card1')).toEqual([{ storeName: 'cards', workspaceId: 'ws1', resourceId: 'card1' }]);
    expect(offlineCacheEntriesForMutation('/api/v1/workspaces/ws1/cards/card1?x=1')).toEqual([{ storeName: 'cards', workspaceId: 'ws1', resourceId: 'card1' }]);
  });

  it('ignores collection posts and entities without offline copies', () => {
    expect(offlineCacheEntriesForMutation('/api/v1/workspaces/ws1/cocktails')).toEqual([]);
    expect(offlineCacheEntriesForMutation('/api/v1/workspaces/ws1/ingredients/i1')).toEqual([]);
    expect(offlineCacheEntriesForMutation('/api/v1/workspaces/ws1/queue')).toEqual([]);
  });
});
