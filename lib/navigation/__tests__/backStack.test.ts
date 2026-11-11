import { describe, expect, it, vi } from 'vitest';
import { BACK_STACK_MARKER, BackStack, readMarker, type BackStackHistory } from '../backStack';

interface Entry {
  state: unknown;
  url: string;
  scroll: ScrollRestoration;
}

const nextState = (as: string, key: string) => ({ __N: true, url: as, as, options: {}, key });

/** Session history of one document: writes are synchronous, traversals are queued like in browsers. */
class FakeHistory implements BackStackHistory {
  entries: Entry[];
  index = 0;
  queued: number[] = [];

  constructor(url = '/a', key = 'ka') {
    this.entries = [{ state: nextState(url, key), url, scroll: 'auto' }];
  }

  get current() {
    return this.entries[this.index];
  }

  state() {
    return this.current.state;
  }

  push(state: unknown, url?: string | URL | null) {
    const current = this.current;
    this.entries = [...this.entries.slice(0, this.index + 1), { state, url: url ? String(url) : current.url, scroll: current.scroll }];
    this.index++;
  }

  replace(state: unknown, url?: string | URL | null) {
    this.entries[this.index] = { ...this.current, state, url: url ? String(url) : this.current.url };
  }

  go(delta: number) {
    this.queued.push(delta);
  }

  scrollRestoration = {
    get: () => this.current.scroll,
    set: (mode: ScrollRestoration) => {
      this.current.scroll = mode;
    },
  };

  urls() {
    return this.entries.map((entry) => entry.url);
  }
}

function setup(url?: string, key?: string) {
  const history = new FakeHistory(url, key);
  let tasks: (() => void)[] = [];
  let tokens = 0;
  const stack = new BackStack({
    history,
    schedule: (callback) => tasks.push(callback),
    createToken: () => `t${++tokens}`,
  });
  /** Popstates that reached Next's router (not consumed by the stack). */
  const nextPops: unknown[] = [];

  const traverse = (delta: number) => {
    history.index = Math.max(0, Math.min(history.entries.length - 1, history.index + delta));
    const state = history.state();
    if (!stack.handlePopState(state)) nextPops.push(state);
  };

  /** Runs deferred work and queued traversals until everything settled. */
  const settle = () => {
    for (let i = 0; i < 20 && (tasks.length > 0 || history.queued.length > 0); i++) {
      const current = tasks;
      tasks = [];
      current.forEach((task) => task());
      const delta = history.queued.shift();
      if (delta !== undefined) traverse(delta);
    }
  };

  return { history, stack, nextPops, settle, userBack: (steps = 1) => traverse(-steps), userForward: () => traverse(1) };
}

describe('BackStack', () => {
  it('pushes one marked entry per layer on top of the tagged page entry', () => {
    const { history, stack, settle } = setup();
    stack.open(vi.fn());
    settle();

    expect(history.urls()).toEqual(['/a', '/a']);
    expect(history.index).toBe(1);
    expect(readMarker(history.entries[0].state)).toEqual({ token: 't1', depth: 0 });
    expect(readMarker(history.entries[1].state)).toEqual({ token: 't1', depth: 1 });
    // Next's state is kept so a stale entry still routes to the right page.
    expect(history.entries[1].state).toMatchObject({ __N: true, as: '/a', key: 'ka' });
  });

  it('closes the top-most layer on back without a route change', () => {
    const { history, stack, nextPops, settle, userBack } = setup();
    const first = vi.fn();
    const second = vi.fn();
    stack.open(first);
    stack.open(second);
    settle();
    expect(history.index).toBe(2);

    userBack();
    settle();
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
    expect(stack.size).toBe(1);

    userBack();
    settle();
    expect(first).toHaveBeenCalledTimes(1);
    expect(stack.size).toBe(0);
    expect(nextPops).toEqual([]);
    expect(history.queued).toEqual([]);
    expect(history.index).toBe(0);
  });

  it('closes several layers when back jumps over several entries', () => {
    const { stack, settle, userBack } = setup();
    const calls: string[] = [];
    stack.open(() => calls.push('first'));
    stack.open(() => calls.push('second'));
    settle();

    userBack(2);
    settle();
    expect(calls).toEqual(['second', 'first']);
  });

  it('removes the entry when the UI closes the layer and ignores the resulting popstate', () => {
    const { history, stack, nextPops, settle } = setup();
    const onBack = vi.fn();
    const id = stack.open(onBack);
    settle();

    stack.close(id);
    settle();
    expect(history.index).toBe(0);
    expect(onBack).not.toHaveBeenCalled();
    expect(nextPops).toEqual([]);
  });

  it('re-uses the entry when one overlay closes and the next opens in the same tick', () => {
    const { history, stack, settle } = setup();
    const id = stack.open(vi.fn());
    settle();
    const goSpy = vi.spyOn(history, 'go');
    const pushSpy = vi.spyOn(history, 'push');

    stack.close(id);
    stack.open(vi.fn());
    settle();
    expect(goSpy).not.toHaveBeenCalled();
    expect(pushSpy).not.toHaveBeenCalled();
    expect(history.index).toBe(1);
  });

  it('removes several entries with a single traversal', () => {
    const { history, stack, settle } = setup();
    const a = stack.open(vi.fn());
    const b = stack.open(vi.fn());
    settle();
    const goSpy = vi.spyOn(history, 'go');

    stack.close(b);
    stack.close(a);
    settle();
    expect(goSpy).toHaveBeenCalledTimes(1);
    expect(goSpy).toHaveBeenCalledWith(-2);
    expect(history.index).toBe(0);
  });

  it('opening during a pending close traversal pushes after the popstate landed', () => {
    const { history, stack, settle } = setup();
    const id = stack.open(vi.fn());
    settle();

    stack.close(id);
    // Run only the deferred flush: it starts the traversal back, the popstate is still pending.
    (stack as unknown as { flush(): void }).flush();
    expect(history.queued).toEqual([-1]);
    const onBack = vi.fn();
    stack.open(onBack);
    settle();
    expect(history.urls()).toEqual(['/a', '/a']);
    expect(history.index).toBe(1);
    expect(readMarker(history.current.state)?.depth).toBe(1);
    expect(onBack).not.toHaveBeenCalled();
  });

  it('extends history.back() from app code to leave the page instead of popping the overlay entry', () => {
    const { history, stack, nextPops, settle } = setup('/b', 'kb');
    // Pretend there is a previous page.
    history.entries.unshift({ state: nextState('/a', 'ka'), url: '/a', scroll: 'auto' });
    history.index = 1;
    const onBack = vi.fn();
    const id = stack.open(onBack);
    settle();
    expect(history.index).toBe(2);

    stack.go(-1); // router.back() in a leave confirmation
    stack.close(id); // the confirmation closes itself afterwards
    settle();
    expect(history.current.url).toBe('/a');
    expect(onBack).not.toHaveBeenCalled();
    expect(nextPops).toEqual([nextState('/a', 'ka')]);
    expect(stack.size).toBe(0);
  });

  it('closes overlays on a page change and replaces the overlay entry (no dangling entries)', () => {
    const { history, stack, nextPops, settle, userBack } = setup();
    const onBack = vi.fn();
    stack.open(onBack);
    settle();

    stack.beforeNavigation(false, false);
    stack.push(nextState('/b', 'kb'), '/b');
    stack.navigationSettled();
    settle();
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(history.urls()).toEqual(['/a', '/b']);

    userBack();
    settle();
    expect(nextPops).toEqual([expect.objectContaining({ as: '/a' })]);
  });

  it('defers a page change that races with the close traversal', () => {
    const { history, stack, nextPops, settle } = setup();
    const id = stack.open(vi.fn());
    settle();

    // Menu item: closes the menu and navigates in the same click.
    stack.close(id);
    (stack as unknown as { flush(): void }).flush();
    stack.beforeNavigation(false, false);
    stack.push(nextState('/b', 'kb'), '/b');
    expect(history.urls()).toEqual(['/a', '/a']);
    settle();
    expect(history.urls()).toEqual(['/a', '/b']);
    expect(history.index).toBe(1);
    expect(nextPops).toEqual([]);
  });

  it('keeps overlays and the URL for shallow updates while open', () => {
    const { history, stack, nextPops, settle, userBack } = setup();
    const onBack = vi.fn();
    stack.open(onBack);
    settle();

    stack.beforeNavigation(true, true);
    stack.push(nextState('/a?card=1', 'kc'), '/a?card=1');
    expect(history.urls()).toEqual(['/a', '/a?card=1']);
    expect(readMarker(history.current.state)?.depth).toBe(1);

    userBack();
    settle();
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(nextPops).toEqual([]);
    expect(history.urls()).toEqual(['/a?card=1', '/a?card=1']);
    expect(history.current.state).toMatchObject({ as: '/a?card=1', [BACK_STACK_MARKER]: { depth: 0 } });
  });

  it('carries replaceState URLs (guest shell search sync) down when the overlay closes', () => {
    const { history, stack, settle } = setup();
    const id = stack.open(vi.fn());
    settle();

    stack.replace(history.state(), '/a?tags=x');
    stack.close(id);
    settle();
    expect(history.index).toBe(0);
    expect(history.current.url).toBe('/a?tags=x');
  });

  it('skips stale overlay entries reached with forward', () => {
    const { history, stack, nextPops, settle, userForward } = setup();
    const id = stack.open(vi.fn());
    settle();
    stack.close(id);
    settle();

    userForward();
    settle();
    expect(history.index).toBe(0);
    expect(nextPops).toEqual([]);
  });

  it('treats stale entries of the shown page as no-op instead of re-navigating', () => {
    const { history, stack, nextPops, settle, userBack } = setup();
    stack.open(vi.fn());
    stack.open(vi.fn());
    settle();
    // Page change while two overlays are open: only the top entry is replaced.
    stack.beforeNavigation(false, false);
    stack.push(nextState('/b', 'kb'), '/b');
    settle();
    expect(history.urls()).toEqual(['/a', '/a', '/b']);

    userBack(); // stale overlay entry of /a → Next navigates to /a
    userBack(); // base entry of /a → already shown
    expect(nextPops).toEqual([expect.objectContaining({ as: '/a' })]);
  });

  it('lets fragment navigations through and keeps the overlay', () => {
    const { stack } = setup();
    stack.open(vi.fn());
    expect(stack.handlePopState(null)).toBe(false);
    expect(stack.size).toBe(1);
  });

  it('disables scroll restoration for overlay entries and restores it afterwards', () => {
    const { history, stack, settle } = setup();
    const id = stack.open(vi.fn());
    settle();
    expect(history.entries.map((entry) => entry.scroll)).toEqual(['manual', 'manual']);

    stack.close(id);
    settle();
    expect(history.entries[0].scroll).toBe('auto');
  });
});
