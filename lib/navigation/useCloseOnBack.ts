import { useEffect, useRef } from 'react';
import { getBackStack } from './backStack';

/**
 * Browser/Android back (and iOS swipe back) closes the overlay instead of leaving the page.
 *
 * While `open` is true the overlay owns a history entry (see ./backStack.ts). Back calls `onClose`;
 * closing it any other way (X, Esc, backdrop, after save, unmount) removes the entry again without a
 * navigation. Nested overlays close one per back press, top-most first (= the order they opened).
 *
 * Pass `enabled: false` for overlays that must not touch the browser history (e.g. inside a preview iframe).
 */
export function useCloseOnBack(open: boolean, onClose: () => void, enabled = true) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open || !enabled) return;
    const stack = getBackStack();
    if (!stack) return;
    const id = stack.open(() => onCloseRef.current());
    return () => stack.close(id);
  }, [open, enabled]);
}
