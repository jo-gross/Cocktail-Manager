import { describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { CREATE_ENTITY_ID, resolveEntityRoute, startEntityLoad } from '../useEntityEditor';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('resolveEntityRoute', () => {
  it('is pending until workspaceId and id are in the query', () => {
    expect(resolveEntityRoute({})).toEqual({ kind: 'pending' });
    expect(resolveEntityRoute({ workspaceId: 'ws' })).toEqual({ kind: 'pending' });
    expect(resolveEntityRoute({ id: 'create' })).toEqual({ kind: 'pending' });
    expect(resolveEntityRoute({ workspaceId: ['ws', 'x'], id: 'abc' })).toEqual({ kind: 'pending' });
  });

  it('recognises the create route', () => {
    expect(resolveEntityRoute({ workspaceId: 'ws', id: CREATE_ENTITY_ID })).toEqual({ kind: 'create', workspaceId: 'ws' });
  });

  it('returns the entity id of an edit route', () => {
    expect(resolveEntityRoute({ workspaceId: 'ws', id: 'abc' })).toEqual({ kind: 'edit', workspaceId: 'ws', id: 'abc' });
  });
});

describe('startEntityLoad', () => {
  it('never requests the entity on the create route', () => {
    const load = vi.fn();
    const setEntity = vi.fn();
    const setLoading = vi.fn();

    startEntityLoad({ kind: 'create', workspaceId: 'ws' }, load, { setEntity, setLoading });

    expect(load).not.toHaveBeenCalled();
    expect(setEntity).toHaveBeenCalledWith(undefined);
    expect(setLoading).toHaveBeenCalledWith(false);
  });

  it('waits while the router query is pending', () => {
    const load = vi.fn();
    const setLoading = vi.fn();

    startEntityLoad({ kind: 'pending' }, load, { setEntity: vi.fn(), setLoading });

    expect(load).not.toHaveBeenCalled();
    expect(setLoading).not.toHaveBeenCalled();
  });

  it('loads the entity of an edit route', async () => {
    const load = vi.fn().mockResolvedValue({ id: 'abc' });
    const setEntity = vi.fn();
    const setLoading = vi.fn();

    startEntityLoad({ kind: 'edit', workspaceId: 'ws', id: 'abc' }, load, { setEntity, setLoading });
    await flush();

    expect(load).toHaveBeenCalledWith('ws', 'abc');
    expect(setEntity).toHaveBeenCalledWith({ id: 'abc' });
    expect(setLoading.mock.calls).toEqual([[true], [false]]);
  });

  it('ignores a response that arrives after the route changed', async () => {
    const pending = deferred<{ id: string }>();
    const setEntity = vi.fn();
    const setLoading = vi.fn();

    const cleanup = startEntityLoad({ kind: 'edit', workspaceId: 'ws', id: 'old' }, () => pending.promise, { setEntity, setLoading });
    cleanup?.();
    pending.resolve({ id: 'old' });
    await flush();

    expect(setEntity).not.toHaveBeenCalled();
    expect(setLoading.mock.calls).toEqual([[true]]);
  });

  it('ends loading when the loader rejects', async () => {
    const setLoading = vi.fn();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    startEntityLoad({ kind: 'edit', workspaceId: 'ws', id: 'abc' }, () => Promise.reject(new Error('boom')), { setEntity: vi.fn(), setLoading });
    await flush();

    expect(setLoading.mock.calls).toEqual([[true], [false]]);
    consoleError.mockRestore();
  });
});

describe('manage edit pages', () => {
  const manageDir = path.resolve(__dirname, '../../../pages/workspaces/[workspaceId]/manage');
  // Guest menus are created by a modal (POST) and opened by their real id; there is no `create` route.
  const withoutCreateRoute = new Set(['guest-menus']);
  // The calculation page loads several things by hand and guards the create route itself.
  const ownCreateGuard = new Set(['calculations']);

  const editPages = fs
    .readdirSync(manageDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(manageDir, entry.name, '[id].tsx')))
    .map((entry) => entry.name);

  it('finds the edit pages', () => {
    expect(editPages).toEqual(expect.arrayContaining(['calculations', 'cards', 'cocktails', 'garnishes', 'glasses', 'ingredients', 'guest-menus']));
  });

  it.each(editPages.filter((name) => !withoutCreateRoute.has(name)))('%s/[id] does not request the entity for the create route', (name) => {
    const source = fs.readFileSync(path.join(manageDir, name, '[id].tsx'), 'utf8');
    if (ownCreateGuard.has(name)) {
      expect(source).toMatch(/if \(id == CREATE_ENTITY_ID\) return;/);
    } else {
      expect(source).toContain('useEntityEditor');
      expect(source).not.toContain('router.query');
    }
  });
});
