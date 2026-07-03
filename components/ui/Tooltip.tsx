import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from './cn';

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Tooltip text/content. When empty, children are rendered without a tooltip wrapper. */
  tip?: React.ReactNode;
  placement?: TooltipPlacement;
}

const VIEWPORT_PADDING = 8;
const TOOLTIP_GAP = 8;

function hasTooltipContent(tip: React.ReactNode): boolean {
  if (tip == null || tip === false) return false;
  if (typeof tip === 'string') return tip.trim().length > 0;
  return true;
}

function calculateTooltipPosition(triggerRect: DOMRect, tooltipRect: DOMRect, placement: TooltipPlacement): { top: number; left: number } {
  let top = 0;
  let left = 0;

  switch (placement) {
    case 'top':
      top = triggerRect.top - tooltipRect.height - TOOLTIP_GAP;
      left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
      break;
    case 'bottom':
      top = triggerRect.bottom + TOOLTIP_GAP;
      left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
      break;
    case 'left':
      top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
      left = triggerRect.left - tooltipRect.width - TOOLTIP_GAP;
      break;
    case 'right':
      top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
      left = triggerRect.right + TOOLTIP_GAP;
      break;
  }

  left = Math.max(VIEWPORT_PADDING, Math.min(left, window.innerWidth - tooltipRect.width - VIEWPORT_PADDING));
  top = Math.max(VIEWPORT_PADDING, Math.min(top, window.innerHeight - tooltipRect.height - VIEWPORT_PADDING));

  return { top, left };
}

/** Tooltip shown on hover/focus; rendered in a portal so overflow containers do not scroll. */
export function Tooltip({ tip, placement = 'top', className, children, ...props }: TooltipProps) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const tooltipId = useId();
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const tooltip = tooltipRef.current;
    if (!trigger || !tooltip) return;

    setCoords(calculateTooltipPosition(trigger.getBoundingClientRect(), tooltip.getBoundingClientRect(), placement));
  }, [placement]);

  const showTooltip = useCallback(() => {
    // Native <dialog> renders in the browser top layer, above any element in the
    // regular DOM regardless of z-index. Portal into the closest open dialog so the
    // tooltip stays on top of (and readable above) the modal; fall back to body.
    const dialog = triggerRef.current?.closest('dialog[open]') as HTMLElement | null;
    setPortalTarget(dialog ?? (typeof document !== 'undefined' ? document.body : null));
    setVisible(true);
  }, []);

  const hideTooltip = useCallback(() => {
    setVisible(false);
    setCoords(null);
  }, []);

  useLayoutEffect(() => {
    if (!visible) return;
    updatePosition();
  }, [visible, tip, placement, updatePosition]);

  useEffect(() => {
    if (!visible) return;

    const handleReposition = () => updatePosition();
    window.addEventListener('scroll', handleReposition, true);
    window.addEventListener('resize', handleReposition);

    return () => {
      window.removeEventListener('scroll', handleReposition, true);
      window.removeEventListener('resize', handleReposition);
    };
  }, [visible, updatePosition]);

  if (!hasTooltipContent(tip)) {
    if (className) {
      return (
        <span className={className} {...props}>
          {children}
        </span>
      );
    }
    return <>{children}</>;
  }

  const tooltipNode =
    visible && portalTarget
      ? createPortal(
          <span
            ref={tooltipRef}
            id={tooltipId}
            role="tooltip"
            className={cn(
              'pointer-events-none fixed z-100 w-max max-w-xs rounded-md bg-neutral px-2 py-1 text-xs whitespace-normal text-neutral-content shadow-lg transition-opacity duration-150',
              coords == null ? 'invisible opacity-0' : 'opacity-100',
            )}
            style={{ top: coords?.top ?? 0, left: coords?.left ?? 0 }}
          >
            {tip}
          </span>,
          portalTarget,
        )
      : null;

  return (
    <>
      <span
        ref={triggerRef}
        className={cn('inline-flex', className)}
        aria-describedby={visible ? tooltipId : undefined}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        {...props}
      >
        {children}
      </span>
      {tooltipNode}
    </>
  );
}
