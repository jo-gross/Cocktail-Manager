import { useEffect, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useCloseOnBack } from '@lib/navigation/useCloseOnBack';
import { CloseIcon } from './icons';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Hide the title visually (still used as accessible name). */
  hideTitle?: boolean;
  /** Browser back closes the sheet. Only for the page that owns the browser history (not the builder preview). */
  closeOnBack?: boolean;
}

/** Bottom sheet (phone) / centered dialog (wide screens). Esc + backdrop (+ optional browser back) close, focus restore, reduced motion aware. */
export function Sheet({ open, onClose, title, closeLabel, children, footer, hideTitle, closeOnBack = false }: SheetProps) {
  const reduceMotion = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);

  useCloseOnBack(open, onClose, closeOnBack);

  useEffect(() => {
    if (!open) return;
    // The builder preview renders the shell into an iframe document.
    const ownerDocument = closeRef.current?.ownerDocument ?? document;
    const ownerWindow = ownerDocument.defaultView ?? window;
    restoreFocus.current = ownerDocument.activeElement as HTMLElement | null;
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const previousOverflow = ownerDocument.body.style.overflow;
    ownerDocument.body.style.overflow = 'hidden';
    ownerWindow.addEventListener('keydown', onKey);
    return () => {
      ownerWindow.removeEventListener('keydown', onKey);
      ownerDocument.body.style.overflow = previousOverflow;
      restoreFocus.current?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  const duration = reduceMotion ? 0 : 0.22;

  return (
    <AnimatePresence>
      {open && (
        <div className="gm-shell-layer">
          <motion.div
            className="gm-shell-backdrop"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration }}
          />
          <motion.div
            className="gm-shell-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={reduceMotion ? { opacity: 0 } : { y: 48, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { y: 48, opacity: 0 }}
            transition={{ duration, ease: 'easeOut' }}
          >
            <div className="gm-shell-handle" aria-hidden="true" />
            <div className="gm-shell-sheet-head">
              {hideTitle ? <span /> : <h2>{title}</h2>}
              <button ref={closeRef} type="button" className="gm-shell-icon-btn" onClick={onClose} aria-label={closeLabel}>
                <CloseIcon />
              </button>
            </div>
            {children}
            {footer && <div className="gm-shell-sheet-foot">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
