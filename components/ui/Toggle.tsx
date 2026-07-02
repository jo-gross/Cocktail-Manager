import React, { forwardRef } from 'react';
import { cn } from './cn';

export type ToggleVariant = 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error';
export type ToggleSize = 'sm' | 'md';

export interface ToggleProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  variant?: ToggleVariant;
  toggleSize?: ToggleSize;
}

const checkedTrackClasses: Record<ToggleVariant, string> = {
  primary: 'checked:bg-primary checked:border-primary',
  secondary: 'checked:bg-secondary checked:border-secondary',
  accent: 'checked:bg-accent checked:border-accent',
  success: 'checked:bg-success checked:border-success',
  warning: 'checked:bg-warning checked:border-warning',
  error: 'checked:bg-error checked:border-error',
};

const sizeClasses: Record<ToggleSize, { track: string; knob: string }> = {
  sm: { track: 'h-5 w-9', knob: 'before:h-3.5 before:w-3.5 checked:before:translate-x-4' },
  md: { track: 'h-6 w-11', knob: 'before:h-4.5 before:w-4.5 checked:before:translate-x-5' },
};

/**
 * Switch control implemented as a single styled checkbox input, so it can be
 * used standalone or nested inside a <Label> without invalid markup.
 */
export const Toggle = forwardRef<HTMLInputElement, ToggleProps>(function Toggle({ variant = 'primary', toggleSize = 'md', className, ...props }, ref) {
  const dims = sizeClasses[toggleSize];
  return (
    <input
      ref={ref}
      type="checkbox"
      role="switch"
      className={cn(
        'relative inline-block shrink-0 cursor-pointer appearance-none rounded-full border border-base-300 bg-base-300 transition-colors',
        'before:absolute before:top-1/2 before:left-0.5 before:-translate-y-1/2 before:rounded-full before:bg-base-100 before:shadow before:transition-transform before:content-[""]',
        'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-base-100 focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-60',
        dims.track,
        dims.knob,
        checkedTrackClasses[variant],
        className,
      )}
      {...props}
    />
  );
});
