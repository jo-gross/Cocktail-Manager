/**
 * Shared registry for blocking client-side navigation (pages router).
 *
 * Next.js only offers one `router.beforePopState` slot and no official way to cancel a
 * `router.push`. This module owns both hooks and dispatches every navigation attempt to the
 * registered guards, so independent features (leave confirmation for unsaved forms, closing
 * modals on browser back, …) compose instead of overwriting each other.
 *
 * - In-app navigation (`router.push/replace`, `<Link>`) is intercepted in `routeChangeStart`
 *   and aborted by throwing {@link NAVIGATION_ABORTED} (a string, so Next's dev overlay ignores it
 *   and the resulting unhandled rejection is swallowed).
 * - Browser back/forward is intercepted via `beforePopState`. The browser has already moved to the
 *   target entry at that point, so a blocked pop re-pushes the current page's history entry.
 *   {@link NavigationGuardRegistry.proceed} then continues with `history.go(-1)`, which lands on the
 *   original target for both back and forward.
 *
 * Do NOT call `router.beforePopState` anywhere else – register a guard here instead.
 */
import Router from 'next/router';

export type NavigationIntent =
  /** `router.push/replace` or a `<Link>` click. `url` is the target as passed to `routeChangeStart`. */
  | { kind: 'push'; url: string; samePage: boolean }
  /** Browser back/forward (popstate). `url` is the `as` path of the target history entry. */
  | { kind: 'pop'; url: string; samePage: boolean };

/**
 * Called for every navigation attempt. Return `true` to block it – the guard then takes over
 * (e.g. shows a confirmation and later calls {@link NavigationGuardRegistry.proceed}).
 */
export type NavigationGuard = (intent: NavigationIntent) => boolean;

export interface NavigationGuardOptions {
  /** Guards with a higher priority are asked first; the first guard that blocks wins. Default 0. */
  priority?: number;
}

/**
 * Suggested priorities so features compose predictably. Overlays (modals, sheets) don't need a guard:
 * ./backStack.ts consumes their history entries' `popstate` before it reaches `beforePopState`, and
 * extends app-level `history.go(-1)` (as used by {@link NavigationGuardRegistry.proceed}) past them.
 */
export const NAVIGATION_GUARD_PRIORITY = {
  /** Guards that must run before leave confirmations. */
  modal: 100,
  /** Leave confirmation for unsaved changes. */
  unsavedChanges: 0,
} as const;

/** Thrown from `routeChangeStart` to abort a blocked `router.push`. */
export const NAVIGATION_ABORTED = 'Navigation aborted by a navigation guard.';

interface RouterEventsLike {
  on(event: string, handler: (...args: never[]) => void): void;
}

export interface NavigationRouterLike {
  asPath: string;
  events: RouterEventsLike;
  beforePopState(cb: (state: { url: string; as: string }) => boolean): void;
  push(url: string): Promise<boolean>;
}

export interface NavigationHistoryLike {
  readonly state: unknown;
  pushState(data: unknown, unused: string, url?: string | null): void;
  go(delta: number): void;
}

export interface NavigationEnvironment {
  router: NavigationRouterLike;
  history: NavigationHistoryLike;
  /** Optional: used to swallow the rejection of aborted `router.push` promises. */
  addUnhandledRejectionListener?: (listener: (event: PromiseRejectionEvent) => void) => void;
}

export interface NavigationGuardRegistry {
  /** Registers a guard. Returns the unregister function. */
  register(guard: NavigationGuard, options?: NavigationGuardOptions): () => void;
  /** Continues a previously blocked navigation, skipping all guards for it. */
  proceed(intent: NavigationIntent): void;
  /** Lets the next navigation pass all guards (e.g. right before redirecting after save/delete). */
  allowNextNavigation(): void;
  /** Installs the router/history hooks. Called lazily on the first registration in the browser. */
  install(environment: NavigationEnvironment): void;
}

/** Path without query, hash and trailing slash. */
export function pathOf(url: string): string {
  const path = url.split(/[?#]/)[0];
  return path.length > 1 ? path.replace(/\/+$/, '') : path;
}

/** True when only query or hash differ (e.g. tab state in the URL) – that is not leaving the page. */
export function isSamePage(currentAsPath: string, targetUrl: string): boolean {
  return pathOf(currentAsPath) === pathOf(targetUrl);
}

interface Registration {
  guard: NavigationGuard;
  priority: number;
  order: number;
}

export function createNavigationGuardRegistry(defaultEnvironment?: () => NavigationEnvironment | undefined): NavigationGuardRegistry {
  let registrations: Registration[] = [];
  let registrationCounter = 0;
  let environment: NavigationEnvironment | undefined;
  /** History state of the entry currently shown – re-pushed when a pop is blocked. */
  let currentHistoryState: unknown;
  /** One navigation may pass without asking the guards. */
  let bypass = false;
  /** A pop already passed `beforePopState`; the `routeChangeStart` it causes must not be asked again. */
  let popInProgress = false;

  const consumeBypass = () => {
    const value = bypass;
    bypass = false;
    return value;
  };

  const isBlocked = (intent: NavigationIntent) => {
    const ordered = [...registrations].sort((a, b) => b.priority - a.priority || b.order - a.order);
    for (const { guard } of ordered) {
      try {
        if (guard(intent)) return true;
      } catch (error) {
        console.error('navigationGuards -> guard failed', error);
      }
    }
    return false;
  };

  const resetTransientState = () => {
    bypass = false;
    popInProgress = false;
  };

  const install = (env: NavigationEnvironment) => {
    if (environment) return;
    environment = env;
    currentHistoryState = env.history.state;

    env.router.events.on('routeChangeStart', ((url: string) => {
      if (popInProgress) {
        popInProgress = false;
        return;
      }
      if (consumeBypass()) return;
      if (isBlocked({ kind: 'push', url, samePage: isSamePage(env.router.asPath, url) })) {
        throw NAVIGATION_ABORTED;
      }
    }) as (...args: never[]) => void);
    const onSettled = () => {
      currentHistoryState = env.history.state;
      resetTransientState();
    };
    env.router.events.on('routeChangeComplete', onSettled);
    env.router.events.on('hashChangeComplete', onSettled);
    env.router.events.on('hashChangeStart', () => {
      popInProgress = false;
    });
    env.router.events.on('routeChangeError', resetTransientState);

    env.router.beforePopState((state) => {
      if (consumeBypass() || !isBlocked({ kind: 'pop', url: state.as, samePage: isSamePage(env.router.asPath, state.as) })) {
        popInProgress = true;
        return true;
      }
      // The browser already shows the target entry – put the current page back on top.
      const current = currentHistoryState as { as?: string } | null | undefined;
      if (current && typeof current === 'object' && current.as) {
        env.history.pushState(current, '', current.as);
      } else {
        env.history.pushState({ __N: true, url: env.router.asPath, as: env.router.asPath, options: {}, key: '' }, '', env.router.asPath);
      }
      return false;
    });

    env.addUnhandledRejectionListener?.((event) => {
      if (event.reason === NAVIGATION_ABORTED) event.preventDefault();
    });
  };

  const ensureInstalled = () => {
    if (environment) return;
    const env = defaultEnvironment?.();
    if (env) install(env);
  };

  return {
    register(guard, options) {
      ensureInstalled();
      const registration: Registration = { guard, priority: options?.priority ?? 0, order: registrationCounter++ };
      registrations = [...registrations, registration];
      return () => {
        registrations = registrations.filter((entry) => entry !== registration);
      };
    },
    proceed(intent) {
      ensureInstalled();
      bypass = true;
      if (intent.kind === 'pop') {
        environment?.history.go(-1);
      } else {
        environment?.router.push(intent.url).catch((error) => console.error('navigationGuards -> proceed', error));
      }
    },
    allowNextNavigation() {
      bypass = true;
    },
    install,
  };
}

function browserEnvironment(): NavigationEnvironment | undefined {
  if (typeof window === 'undefined' || !Router.router) return undefined;
  return {
    router: Router as unknown as NavigationRouterLike,
    history: window.history,
    addUnhandledRejectionListener: (listener) => window.addEventListener('unhandledrejection', listener),
  };
}

/** App-wide registry (installs itself on the first registration in the browser). */
export const navigationGuards = createNavigationGuardRegistry(browserEnvironment);
