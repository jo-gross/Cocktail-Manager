import React from 'react';
import { cn } from './cn';

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Tooltip text/content. When empty, children are rendered without a tooltip wrapper. */
  tip?: React.ReactNode;
  placement?: TooltipPlacement;
}

const placementClasses: Record<TooltipPlacement, string> = {
  top: 'bottom-full left-1/2 mb-2 -translate-x-1/2',
  bottom: 'top-full left-1/2 mt-2 -translate-x-1/2',
  left: 'right-full top-1/2 mr-2 -translate-y-1/2',
  right: 'left-full top-1/2 ml-2 -translate-y-1/2',
};

function hasTooltipContent(tip: React.ReactNode): boolean {
  if (tip == null || tip === false) return false;
  if (typeof tip === 'string') return tip.trim().length > 0;
  return true;
}

/** CSS-only tooltip shown on hover/focus of its children. */
export function Tooltip({ tip, placement = 'top', className, children, ...props }: TooltipProps) {
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

  return (
    <span className={cn('group/tooltip relative inline-flex', className)} {...props}>
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute z-50 w-max max-w-xs rounded-md bg-neutral px-2 py-1 text-xs whitespace-normal text-neutral-content opacity-0 shadow-lg transition-opacity delay-300 duration-150',
          'group-focus-within/tooltip:opacity-100 group-hover/tooltip:opacity-100',
          placementClasses[placement],
        )}
      >
        {tip}
      </span>
    </span>
  );
}
