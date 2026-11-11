import { describe, expect, it, vi } from 'vitest';
import { createNavigationGuardRegistry, isSamePage, NAVIGATION_ABORTED, pathOf, type NavigationEnvironment, type NavigationIntent } from '../navigationGuards';

type Handler = (...args: unknown[]) => void;

function createFakeEnvironment(asPath = '/workspaces/w/manage/cocktails/c1') {
  const handlers: Record<string, Handler[]> = {};
  let popStateCallback: ((state: { url: string; as: string }) => boolean) | undefined;
  let rejectionListener: ((event: PromiseRejectionEvent) => void) | undefined;
  const currentEntry = { __N: true, url: '/workspaces/[workspaceId]/manage/cocktails/[id]', as: asPath, options: {}, key: 'k1' };
  const history = {
    state: currentEntry as unknown,
    pushState: vi.fn(),
    go: vi.fn(),
  };
  const router = {
    asPath,
    events: {
      on: (event: string, handler: Handler) => {
        (handlers[event] ??= []).push(handler);
      },
    },
    beforePopState: (cb: (state: { url: string; as: string }) => boolean) => {
      popStateCallback = cb;
    },
    push: vi.fn(async () => true),
  };
  const environment = {
    router,
    history,
    addUnhandledRejectionListener: (listener: (event: PromiseRejectionEvent) => void) => {
      rejectionListener = listener;
    },
  } as unknown as NavigationEnvironment;

  return {
    environment,
    history,
    router,
    currentEntry,
    emit: (event: string, ...args: unknown[]) => (handlers[event] ?? []).forEach((handler) => handler(...args)),
    pop: (as: string) => popStateCallback!({ url: as, as }),
    rejection: (reason: unknown) => {
      const event = { reason, preventDefault: vi.fn() };
      rejectionListener!(event as unknown as PromiseRejectionEvent);
      return event;
    },
  };
}

function setup() {
  const fake = createFakeEnvironment();
  const registry = createNavigationGuardRegistry();
  registry.install(fake.environment);
  return { ...fake, registry };
}

describe('path helpers', () => {
  it('strips query, hash and trailing slash', () => {
    expect(pathOf('/a/b/?tab=1#x')).toBe('/a/b');
    expect(pathOf('/')).toBe('/');
  });

  it('treats query/hash-only changes as the same page', () => {
    expect(isSamePage('/a/b?tab=1', '/a/b#c')).toBe(true);
    expect(isSamePage('/a/b', '/a/c')).toBe(false);
  });
});

describe('navigation guard registry', () => {
  it('lets navigation pass without guards', () => {
    const { emit, pop } = setup();
    expect(() => emit('routeChangeStart', '/somewhere')).not.toThrow();
    expect(pop('/back')).toBe(true);
  });

  it('aborts a blocked router.push and swallows the resulting rejection', () => {
    const { registry, emit, rejection } = setup();
    const guard = vi.fn(() => true);
    registry.register(guard);

    expect(() => emit('routeChangeStart', '/workspaces/w/manage/cocktails')).toThrow(NAVIGATION_ABORTED);
    expect(guard).toHaveBeenCalledWith({ kind: 'push', url: '/workspaces/w/manage/cocktails', samePage: false } satisfies NavigationIntent);
    expect(rejection(NAVIGATION_ABORTED).preventDefault).toHaveBeenCalled();
    expect(rejection(new Error('other')).preventDefault).not.toHaveBeenCalled();
  });

  it('marks query-only navigation as same page', () => {
    const { registry, emit } = setup();
    const guard = vi.fn((intent: NavigationIntent) => !intent.samePage);
    registry.register(guard);
    expect(() => emit('routeChangeStart', '/workspaces/w/manage/cocktails/c1?tab=2')).not.toThrow();
  });

  it('restores the current entry when a pop is blocked and continues with history.go(-1)', () => {
    const { registry, pop, history, currentEntry, emit } = setup();
    let block = true;
    registry.register(() => block);

    expect(pop('/workspaces/w/manage/cocktails')).toBe(false);
    expect(history.pushState).toHaveBeenCalledWith(currentEntry, '', currentEntry.as);

    block = false;
    registry.proceed({ kind: 'pop', url: '/workspaces/w/manage/cocktails', samePage: false });
    expect(history.go).toHaveBeenCalledWith(-1);
    // The continued pop and the route change it causes are not asked again.
    block = true;
    expect(pop('/workspaces/w/manage/cocktails')).toBe(true);
    expect(() => emit('routeChangeStart', '/workspaces/w/manage/cocktails')).not.toThrow();
    // …but the next navigation is.
    expect(() => emit('routeChangeStart', '/elsewhere')).toThrow(NAVIGATION_ABORTED);
  });

  it('proceeds a blocked push by pushing the target once without asking the guards', () => {
    const { registry, emit, router } = setup();
    registry.register(() => true);
    registry.proceed({ kind: 'push', url: '/target', samePage: false });
    expect(router.push).toHaveBeenCalledWith('/target');
    expect(() => emit('routeChangeStart', '/target')).not.toThrow();
    expect(() => emit('routeChangeStart', '/target')).toThrow(NAVIGATION_ABORTED);
  });

  it('allowNextNavigation is cleared once a route change settled', () => {
    const { registry, emit } = setup();
    registry.register(() => true);
    registry.allowNextNavigation();
    emit('routeChangeComplete', '/x');
    expect(() => emit('routeChangeStart', '/y')).toThrow(NAVIGATION_ABORTED);
  });

  it('asks guards by priority and stops at the first one that blocks', () => {
    const { registry, emit } = setup();
    const calls: string[] = [];
    registry.register(() => {
      calls.push('leave');
      return true;
    });
    registry.register(
      () => {
        calls.push('modal');
        return true;
      },
      { priority: 100 },
    );
    expect(() => emit('routeChangeStart', '/y')).toThrow(NAVIGATION_ABORTED);
    expect(calls).toEqual(['modal']);
  });

  it('unregisters guards', () => {
    const { registry, emit } = setup();
    const unregister = registry.register(() => true);
    unregister();
    expect(() => emit('routeChangeStart', '/y')).not.toThrow();
  });

  it('re-pushes the state of the page shown last after navigation completed', () => {
    const { registry, pop, history, emit } = setup();
    registry.register(() => true);
    const nextEntry = { __N: true, url: '/next', as: '/next', options: {}, key: 'k2' };
    history.state = nextEntry;
    emit('routeChangeComplete', '/next');
    pop('/prev');
    expect(history.pushState).toHaveBeenCalledWith(nextEntry, '', '/next');
  });
});
