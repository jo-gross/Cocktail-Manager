import React, { forwardRef } from 'react';
import { cn } from './cn';

export interface ButtonGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical';
  /** Shorthand for `orientation="vertical"`. */
  vertical?: boolean;
}

/**
 * Groups adjacent buttons/inputs into a single connected control (replacement for
 * DaisyUI `join`/`join-item`). Inner corners are flattened and borders overlapped;
 * only the outer corners stay rounded.
 */
export const ButtonGroup = forwardRef<HTMLDivElement, ButtonGroupProps>(function ButtonGroup(
  { orientation, vertical = false, className, children, ...props },
  ref,
) {
  const isHorizontal = (orientation ?? (vertical ? 'vertical' : 'horizontal')) === 'horizontal';
  return (
    <div
      ref={ref}
      className={cn(
        'flex items-stretch',
        isHorizontal
          ? '[&>*:first-child]:rounded-l-lg [&>*:last-child]:rounded-r-lg [&>*:not(:first-child)]:-ml-px [&>*:not(:first-child)]:rounded-l-none [&>*:not(:last-child)]:rounded-r-none'
          : 'flex-col [&>*:first-child]:rounded-t-lg [&>*:last-child]:rounded-b-lg [&>*:not(:first-child)]:-mt-px [&>*:not(:first-child)]:rounded-t-none [&>*:not(:last-child)]:rounded-b-none',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
});
