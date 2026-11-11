/**
 * "Back closes the top-most overlay" – shared history bookkeeping for modals, sheets and menus.
 *
 * Every open overlay (a *layer*) owns one extra history entry on top of the page's entry (the *base*).
 * The entries are clones of the page's own history state (Next's `__N`, `url`, `as`, `key`, …) plus a
 * {@link BACK_STACK_MARKER} with a per-stack token and the entry's depth (base = 0, layer n = n).
 *
 * - Browser/Android back or iOS swipe back moves to a lower depth of our stack → the layers above it
 *   are closed (top-most first) and the `popstate` event is consumed in a capture-phase listener
 *   (`stopImmediatePropagation`), so neither Next's router nor `router.beforePopState` (owned by
 *   ./navigationGuards.ts) ever see it. No route change, no data refetch.
 * - Closing a layer from the UI (X, Esc, backdrop, after save) removes its entry with an own
 *   `history.go(-n)`. History changes are deferred to a microtask, so closing one overlay and opening
 *   the next one in the same tick re-uses the entry. While such a traversal is in flight, further
 *   history writes (also Next's `pushState`/`replaceState`) are queued and replayed after it landed.
 * - While a layer is open, the app's own `pushState` (e.g. shallow query updates) and `replaceState`
 *   (e.g. the guest shell's URL sync) are applied to the overlay entry and carried down to the lower
 *   entries once they are shown again, so the URL never jumps back.
 * - A real page change (`beforeHistoryChange` for another pathname) closes all layers and turns
 *   Next's `pushState` into a `replaceState` of the overlay entry → no dangling entries.
 * - `history.back()`/`go(-n)` called by app code (e.g. `router.back()` in a leave confirmation shown in
 *   a modal) means "leave the page": the delta is extended to skip the overlay entries.
 *
 * Composition order on browser back: overlays (this module) → leave guards (./navigationGuards.ts,
 * via `beforePopState`) → normal Next navigation. Overlays never need to register a navigation guard.
 *
 * Use {@link useCloseOnBack} (./useCloseOnBack.ts) in components; this module holds the pure logic
 * ({@link BackStack}) and the browser installation ({@link getBackStack}).
 */
import Router from 'next/router';
import { isSamePage } from './navigationGuards';

export const BACK_STACK_MARKER = '__backStack';

interface Marker {
  token: string;
  depth: number;
}

type Url = string | URL | null | undefined;

/** Raw (unpatched) history access. */
export interface BackStackHistory {
  state(): unknown;
  push(state: unknown, url?: Url): void;
  replace(state: unknown, url?: Url): void;
  /** Must eventually lead to exactly one {@link BackStack.handlePopState} call. */
  go(delta: number): void;
  /** Per-entry scroll restoration mode (`history.scrollRestoration`). */
  scrollRestoration?: {
    get(): ScrollRestoration;
    set(mode: ScrollRestoration): void;
  };
}

export interface BackStackOptions {
  history: BackStackHistory;
  /** Defers history syncing (default: queueMicrotask). */
  schedule?: (callback: () => void) => void;
  createToken?: () => string;
  /** Fallback when a traversal never produces a popstate (e.g. the browser dropped it). */
  setTimer?: (callback: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

interface Layer {
  id: number;
  onBack: () => void;
}

interface Traversal {
  /** Started by this module (consume the popstate) or by app code via {@link BackStack.go} (let Next handle it). */
  internal: boolean;
  /** Expected depth after landing (internal traversals only). */
  target: number | null;
}

type DeferredWrite = { method: 'push' | 'replace'; state: unknown; url: Url };

const TRAVERSAL_TIMEOUT_MS = 1000;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function readMarker(state: unknown): Marker | null {
  const marker = isObject(state) ? state[BACK_STACK_MARKER] : undefined;
  return isObject(marker) && typeof marker.token === 'string' && typeof marker.depth === 'number' ? (marker as unknown as Marker) : null;
}

export function stripMarker(state: unknown): unknown {
  if (!isObject(state) || !(BACK_STACK_MARKER in state)) return state;
  const { [BACK_STACK_MARKER]: _marker, ...rest } = state;
  return rest;
}

function keyOf(state: unknown): unknown {
  return isObject(state) ? state.key : undefined;
}

let tokenCounter = 0;
const defaultToken = () => `${Date.now().toString(36)}-${(tokenCounter++).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export class BackStack {
  private readonly history: BackStackHistory;
  private readonly schedule: (callback: () => void) => void;
  private readonly createToken: () => string;
  private readonly options: BackStackOptions;

  private layers: Layer[] = [];
  private layerCounter = 0;
  /** Token of the active stack; `null` while no base entry is tagged. */
  private token: string | null = null;
  /** Depth of the current history entry within the active stack. */
  private depth = 0;
  private traversals: Traversal[] = [];
  private traversalTimer: unknown = null;
  private deferred: DeferredWrite[] = [];
  private flushScheduled = false;
  /** Latest state/url written to an overlay entry – applied to lower entries when they are shown again. */
  private carry: { state: unknown; url: Url } | null = null;
  /** Next's history key of the shown entry – detects stale duplicates of the current page. */
  private lastKey: unknown;
  /** The next push is a page change while an overlay entry is shown → replace that entry instead. */
  private convertNextPush = false;
  private savedScrollRestoration: ScrollRestoration | null = null;

  constructor(options: BackStackOptions) {
    this.options = options;
    this.history = options.history;
    this.schedule = options.schedule ?? ((callback) => queueMicrotask(callback));
    this.createToken = options.createToken ?? defaultToken;
    this.lastKey = keyOf(this.history.state());
  }

  /** Number of open layers. */
  get size(): number {
    return this.layers.length;
  }

  /** Registers an open overlay on top of the stack. `onBack` is called when back closes it. Returns its id. */
  open(onBack: () => void): number {
    const id = ++this.layerCounter;
    this.layers = [...this.layers, { id, onBack }];
    this.scheduleFlush();
    return id;
  }

  /** The overlay was closed by the UI (or unmounted): drop its history entry. No-op if back already closed it. */
  close(id: number): void {
    const next = this.layers.filter((layer) => layer.id !== id);
    if (next.length === this.layers.length) return;
    this.layers = next;
    this.scheduleFlush();
  }

  /**
   * Handles a `popstate`. Returns `true` when the event belongs to the overlay stack and must not reach
   * Next's router (the caller stops its propagation).
   */
  handlePopState(state: unknown): boolean {
    const traversal = this.traversals.shift();
    if (this.traversals.length === 0) this.clearTraversalTimer();

    const marker = readMarker(state);
    const ownDepth = marker !== null && this.token !== null && marker.token === this.token ? marker.depth : null;

    if (traversal?.internal) {
      // Landing where we wanted to: overlays opened meanwhile get their entries in the next flush.
      if (ownDepth !== null) this.land(state, ownDepth, ownDepth >= (traversal.target ?? 0));
      this.afterTraversal();
      return true;
    }

    if (ownDepth !== null) {
      this.land(state, ownDepth);
      this.afterTraversal();
      return true;
    }

    // Fragment navigation (`<a href="#…">`): not a page change – keep the overlays.
    if (state === null || state === undefined) return false;

    // Left the stack (previous/next page or an entry of an older stack): overlays belong to the old view.
    const key = keyOf(state);
    const duplicateOfShownPage = key !== undefined && key === this.lastKey;
    this.reset();
    this.lastKey = key;
    this.afterTraversal();
    // Stale overlay entries of the page that is already shown – nothing to navigate.
    return duplicateOfShownPage;
  }

  /** Next is about to write history for a navigation (`beforeHistoryChange`). */
  beforeNavigation(samePage: boolean, shallow: boolean): void {
    if (shallow || samePage) return;
    // A real page change: close the overlays without touching history and let the push replace the overlay entry.
    if (this.traversals.length === 0 && this.token !== null && this.depth > 0) this.convertNextPush = true;
    this.reset();
  }

  /** Navigation finished or failed – a pending push conversion must not leak into later pushes. */
  navigationSettled(): void {
    this.convertNextPush = false;
  }

  /** Replacement for `history.pushState` (app code and Next). */
  push(state: unknown, url?: Url): void {
    if (this.traversals.length > 0) {
      this.deferred.push({ method: 'push', state, url });
      return;
    }
    this.lastKey = keyOf(state);
    if (this.convertNextPush) {
      this.convertNextPush = false;
      this.history.replace(state, url);
      this.restoreScrollRestoration();
      return;
    }
    if (this.token !== null && this.depth > 0) {
      // Keep the stack flat while an overlay is open – back must close it, not undo e.g. a shallow query update.
      this.carry = { state: stripMarker(state), url };
      this.history.replace(this.withMarker(state, this.depth), url);
      return;
    }
    this.token = null;
    this.carry = null;
    this.history.push(state, url);
  }

  /** Replacement for `history.replaceState` (app code and Next). */
  replace(state: unknown, url?: Url): void {
    if (this.traversals.length > 0) {
      this.deferred.push({ method: 'replace', state, url });
      return;
    }
    this.convertNextPush = false;
    const key = keyOf(state);
    if (key !== undefined) this.lastKey = key;
    if (this.token === null) {
      this.history.replace(state, url);
      return;
    }
    this.carry = this.depth > 0 ? { state: stripMarker(state), url } : null;
    this.history.replace(this.withMarker(state, this.depth), url);
  }

  /** Replacement for `history.go/back` called by app code: going back means leaving the page, so skip the overlay entries. */
  go(delta: number): void {
    if (delta >= 0 || this.token === null) {
      this.history.go(delta);
      return;
    }
    const lastInternal = [...this.traversals].reverse().find((traversal) => traversal.internal);
    const position = lastInternal?.target ?? this.depth;
    this.traverse(delta - position, false, null);
  }

  private land(state: unknown, target: number, keepLayers = false) {
    const previous = this.depth;
    this.depth = target;
    this.lastKey = keyOf(state);
    if (!keepLayers && this.layers.length > target) {
      const closed = this.layers.slice(target).reverse();
      this.layers = this.layers.slice(0, target);
      closed.forEach((layer) => this.callOnBack(layer));
    }
    if (this.carry && target < previous) {
      this.history.replace(this.withMarker(this.carry.state, target), this.carry.url);
    }
    if (target === 0) this.carry = null;
  }

  private afterTraversal() {
    if (this.traversals.length > 0) return;
    if (this.depth === 0 && this.layers.length === 0) this.restoreScrollRestoration();
    const deferred = this.deferred;
    this.deferred = [];
    for (const write of deferred) {
      if (write.method === 'push') this.push(write.state, write.url);
      else this.replace(write.state, write.url);
    }
    this.scheduleFlush();
  }

  /** Closes all layers without touching history and forgets the stack. */
  private reset() {
    const closed = [...this.layers].reverse();
    this.layers = [];
    this.token = null;
    this.depth = 0;
    this.carry = null;
    // savedScrollRestoration is kept: it is restored on the entry shown after the next landing/push conversion.
    closed.forEach((layer) => this.callOnBack(layer));
  }

  private callOnBack(layer: Layer) {
    try {
      layer.onBack();
    } catch (error) {
      console.error('backStack -> onBack failed', error);
    }
  }

  private scheduleFlush() {
    if (this.flushScheduled) return;
    this.flushScheduled = true;
    this.schedule(() => {
      this.flushScheduled = false;
      this.flush();
    });
  }

  /** Brings the history depth in line with the number of open layers. */
  private flush() {
    if (this.traversals.length > 0) return;
    const desired = this.layers.length;
    if (this.token === null) {
      if (desired === 0) return;
      this.token = this.createToken();
      this.depth = 0;
      this.history.replace(this.withMarker(this.history.state(), 0));
    }
    if (this.depth < desired) {
      // Overlay entries must not restore a scroll position of their own when traversed.
      this.disableScrollRestoration();
      const base = stripMarker(this.history.state());
      for (let depth = this.depth + 1; depth <= desired; depth++) {
        this.history.push(this.withMarker(base, depth));
        this.disableScrollRestoration();
      }
      this.depth = desired;
    } else if (this.depth > desired) {
      this.traverse(desired - this.depth, true, desired);
    }
  }

  private traverse(delta: number, internal: boolean, target: number | null) {
    this.traversals.push({ internal, target });
    this.clearTraversalTimer();
    if (this.options.setTimer) {
      this.traversalTimer = this.options.setTimer(() => {
        this.traversalTimer = null;
        // The popstate never arrived – stop waiting so later history writes are not stuck.
        this.traversals = [];
        if (internal && target !== null) this.depth = target;
        this.afterTraversal();
      }, TRAVERSAL_TIMEOUT_MS);
    }
    this.history.go(delta);
  }

  private clearTraversalTimer() {
    if (this.traversalTimer !== null) this.options.clearTimer?.(this.traversalTimer);
    this.traversalTimer = null;
  }

  private withMarker(state: unknown, depth: number): Record<string, unknown> {
    const marker: Marker = { token: this.token ?? '', depth };
    return { ...(isObject(stripMarker(state)) ? (stripMarker(state) as Record<string, unknown>) : {}), [BACK_STACK_MARKER]: marker };
  }

  private disableScrollRestoration() {
    const scroll = this.history.scrollRestoration;
    if (!scroll) return;
    if (this.savedScrollRestoration === null) this.savedScrollRestoration = scroll.get();
    scroll.set('manual');
  }

  private restoreScrollRestoration() {
    const scroll = this.history.scrollRestoration;
    if (!scroll || this.savedScrollRestoration === null) return;
    scroll.set(this.savedScrollRestoration);
    this.savedScrollRestoration = null;
  }
}

let instance: BackStack | null = null;

/**
 * The app-wide stack. Installs itself on first use in the browser: patches `history.pushState`,
 * `replaceState`, `back` and `go`, adds a capture-phase `popstate` listener and listens to Next's
 * router events. Returns `null` on the server.
 */
export function getBackStack(): BackStack | null {
  if (typeof window === 'undefined') return null;
  if (instance) return instance;

  const history = window.history;
  const pushState = history.pushState.bind(history);
  const replaceState = history.replaceState.bind(history);
  const go = history.go.bind(history);

  const stack = new BackStack({
    history: {
      state: () => history.state,
      push: (state, url) => pushState(state, '', url),
      replace: (state, url) => replaceState(state, '', url),
      go: (delta) => go(delta),
      scrollRestoration:
        'scrollRestoration' in history ? { get: () => history.scrollRestoration, set: (mode) => (history.scrollRestoration = mode) } : undefined,
    },
    setTimer: (callback, ms) => window.setTimeout(callback, ms),
    clearTimer: (handle) => window.clearTimeout(handle as number),
  });
  instance = stack;

  history.pushState = (data: unknown, _unused: string, url?: Url) => stack.push(data, url);
  history.replaceState = (data: unknown, _unused: string, url?: Url) => stack.replace(data, url);
  history.back = () => stack.go(-1);
  history.go = (delta?: number) => (delta ? stack.go(delta) : go(delta));

  // Capture listeners on the target run before Next's (bubble) popstate listener.
  window.addEventListener(
    'popstate',
    (event) => {
      if (stack.handlePopState(event.state)) event.stopImmediatePropagation();
    },
    { capture: true },
  );

  Router.events.on('beforeHistoryChange', (as: string, { shallow }: { shallow: boolean }) => {
    stack.beforeNavigation(isSamePage(window.location.pathname, as), shallow);
  });
  Router.events.on('routeChangeComplete', () => stack.navigationSettled());
  Router.events.on('routeChangeError', () => stack.navigationSettled());

  return stack;
}
