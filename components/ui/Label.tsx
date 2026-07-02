import React, { forwardRef } from 'react';
import { cn } from './cn';

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;

/** Form label wrapper. Compose with <LabelText> / <LabelTextAlt> inside. */
export const Label = forwardRef<HTMLLabelElement, LabelProps>(function Label({ className, children, ...props }, ref) {
  return (
    <label ref={ref} className={cn('flex items-center gap-1 py-1 text-sm font-medium text-base-content', className)} {...props}>
      {children}
    </label>
  );
});

export type LabelTextProps = React.HTMLAttributes<HTMLSpanElement>;

/** Primary text inside a <Label>. */
export function LabelText({ className, children, ...props }: LabelTextProps) {
  return (
    <span className={cn('text-sm', className)} {...props}>
      {children}
    </span>
  );
}

export type LabelTextAltProps = React.HTMLAttributes<HTMLSpanElement>;

/** Secondary/auxiliary text inside a <Label> (e.g. validation messages). */
export function LabelTextAlt({ className, children, ...props }: LabelTextAltProps) {
  return (
    <span className={cn('flex items-center gap-1 text-xs', className)} {...props}>
      {children}
    </span>
  );
}
