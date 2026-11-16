import { tourTargetSelector, type TourTargetId } from '@lib/tours/targets';

/** First rendered (non-zero size) element with the anchor – the same id may be set on alternative elements. */
export function findTourTarget(id: TourTargetId): HTMLElement | null {
  const elements = document.querySelectorAll<HTMLElement>(tourTargetSelector(id));
  for (const element of elements) {
    const rect = element.getBoundingClientRect();
    if (rect.width > 0 || rect.height > 0) return element;
  }
  return null;
}

/** Resolves with the target once it is rendered, or `null` after `timeoutMs` / when aborted. */
export function waitForTourTarget(id: TourTargetId, timeoutMs: number, signal: AbortSignal): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    const found = findTourTarget(id);
    if (found) {
      resolve(found);
      return;
    }

    let frame = 0;
    const finish = (element: HTMLElement | null) => {
      observer.disconnect();
      window.clearTimeout(timeout);
      window.clearInterval(poll);
      cancelAnimationFrame(frame);
      signal.removeEventListener('abort', onAbort);
      resolve(element);
    };
    const check = () => {
      const element = findTourTarget(id);
      if (element) finish(element);
    };
    const onAbort = () => finish(null);

    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(check);
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'data-tour'] });
    // Size changes through CSS only (e.g. `md:` breakpoints) produce no mutation.
    const poll = window.setInterval(check, 250);
    const timeout = window.setTimeout(() => finish(null), timeoutMs);
    signal.addEventListener('abort', onAbort);
  });
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Focus is in a text field / control that uses arrow keys itself. */
export function isEditableElement(element: Element | null): boolean {
  if (!element) return false;
  const tag = element.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (element as HTMLElement).isContentEditable;
}

/** SVG path of a rounded rectangle (used as cutout with `fill-rule="evenodd"`, so hit testing matches the shape). */
export function roundedRectPath(x: number, y: number, width: number, height: number, radius: number): string {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  return [
    `M${x + r} ${y}`,
    `H${x + width - r}`,
    `A${r} ${r} 0 0 1 ${x + width} ${y + r}`,
    `V${y + height - r}`,
    `A${r} ${r} 0 0 1 ${x + width - r} ${y + height}`,
    `H${x + r}`,
    `A${r} ${r} 0 0 1 ${x} ${y + height - r}`,
    `V${y + r}`,
    `A${r} ${r} 0 0 1 ${x + r} ${y}`,
    'Z',
  ].join(' ');
}
