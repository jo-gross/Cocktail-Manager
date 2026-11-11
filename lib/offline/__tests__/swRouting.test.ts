import { describe, expect, it } from 'vitest';
import { classifySwRequest } from '../swRouting';

const ORIGIN = 'https://bar.example.com';

function classify(path: string, options: { sameOrigin?: boolean; mode?: string; origin?: string } = {}) {
  return classifySwRequest({ url: new URL(path, options.origin ?? ORIGIN), sameOrigin: options.sameOrigin ?? true, mode: options.mode ?? 'cors' });
}

describe('classifySwRequest', () => {
  it('never serves entity JSON from a stale cache (network first)', () => {
    expect(classify('/api/v1/workspaces/ws1/ingredients/ing1')).toBe('api');
    expect(classify('/api/v1/workspaces/ws1/cocktails/c1')).toBe('api');
    expect(classify('/api/v1/workspaces/ws1/garnishes?search=x')).toBe('api');
    expect(classify('/api/users')).toBe('api');
  });

  it('routes entity images to the network-first image cache', () => {
    expect(classify('/api/v1/workspaces/ws1/ingredients/ing1/image')).toBe('api-image');
    expect(classify('/api/v1/workspaces/ws1/cocktails/c1/image')).toBe('api-image');
    expect(classify('/api/v1/workspaces/ws1/garnishes/g1/image')).toBe('api-image');
    expect(classify('/api/v1/workspaces/ws1/glasses/g1/image')).toBe('api-image');
    expect(classify('/api/v1/workspaces/ws1/admin/signage/slides/s1/image')).toBe('api-image');
  });

  it('keeps live data and guest menus out of every cache', () => {
    expect(classify('/api/v1/workspaces/ws1/queue')).toBe('network-only');
    expect(classify('/api/v1/workspaces/ws1/cocktails/c1/ratings')).toBe('network-only');
    expect(classify('/m/my-bar/menu')).toBe('network-only');
    expect(classify('/api/public/menus/my-bar/menu')).toBe('network-only');
    expect(classify('/_next/data/build123/m/my-bar/menu.json')).toBe('network-only');
    expect(classify('/api/public/images/my-bar/cocktail/c1')).toBe('network-only');
  });

  it('never caches auth flows but keeps the session lookup available offline', () => {
    expect(classify('/api/auth/callback/google')).toBe('network-only');
    expect(classify('/api/auth/sign-out')).toBe('network-only');
    expect(classify('/api/auth/get-session')).toBe('api');
  });

  it('uses network first for navigations and stale-while-revalidate for static assets', () => {
    expect(classify('/workspaces/ws1/manage/ingredients/ing1', { mode: 'navigate' })).toBe('page');
    expect(classify('/images/logo.png')).toBe('static');
    expect(classify('/fonts/inter.woff2')).toBe('static');
  });

  it('does not treat cross-origin /api/ paths as own API', () => {
    expect(classify('/api/v1/workspaces/ws1/cocktails/c1', { sameOrigin: false, origin: 'https://other.example.com' })).toBe('static');
    expect(classify('/m/foo', { sameOrigin: false, origin: 'https://other.example.com' })).toBe('static');
  });
});
