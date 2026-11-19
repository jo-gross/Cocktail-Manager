import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiV1FetchSafe, fetchWithCache } = vi.hoisted(() => ({
  apiV1FetchSafe: vi.fn(() => Promise.resolve([])),
  fetchWithCache: vi.fn(() => Promise.resolve({ data: undefined, fromCache: false })),
}));

vi.mock('../apiV1', () => ({ apiV1FetchSafe, apiV1Mutate: vi.fn(), apiV1Fetch: vi.fn() }));
vi.mock('../fetchWithCache', () => ({ fetchWithCache, fetchListWithCache: vi.fn() }));
vi.mock('@lib/i18n/client', () => ({ i18n: { t: (key: string) => key } }));
vi.mock('../../alertService', () => ({ alertService: { error: vi.fn() } }));

import { fetchCocktailRatings } from '../cocktailRatings';
import { fetchCocktail } from '../cocktails';

describe('cocktail fetches without cocktail id (create form preview)', () => {
  beforeEach(() => {
    apiV1FetchSafe.mockClear();
    fetchWithCache.mockClear();
  });

  it('does not request `cocktails//ratings` for an unsaved cocktail', () => {
    const setLoading = vi.fn();
    fetchCocktailRatings('ws1', '', vi.fn(), setLoading, vi.fn());
    expect(apiV1FetchSafe).not.toHaveBeenCalled();
    expect(setLoading).not.toHaveBeenCalled();
  });

  it('does not request `cocktails/` (the list endpoint) for an unsaved cocktail', () => {
    const setLoading = vi.fn();
    fetchCocktail('ws1', '', vi.fn(), setLoading);
    expect(fetchWithCache).not.toHaveBeenCalled();
    expect(setLoading).not.toHaveBeenCalled();
  });

  it('still loads a saved cocktail', () => {
    fetchCocktailRatings('ws1', 'c1', vi.fn(), vi.fn(), vi.fn());
    fetchCocktail('ws1', 'c1', vi.fn(), vi.fn());
    expect(apiV1FetchSafe).toHaveBeenCalledWith('/api/v1/workspaces/ws1/cocktails/c1/ratings', expect.anything(), expect.anything());
    expect(fetchWithCache).toHaveBeenCalledWith(expect.objectContaining({ url: '/api/v1/workspaces/ws1/cocktails/c1' }));
  });
});
