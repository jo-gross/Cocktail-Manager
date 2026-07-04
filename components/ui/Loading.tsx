import React from 'react';
import { cn } from './cn';

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg';

export interface SpinnerProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: SpinnerSize;
}

const spinnerSizeClasses: Record<SpinnerSize, string> = {
  xs: 'h-3 w-3 border-2',
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-9 w-9 border-[3px]',
};

/**
 * Simple bordered spinner. Inherits the current text color, so it adapts to the
 * surrounding button/text color automatically.
 */
export function Spinner({ size = 'md', className, ...props }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="loading"
      className={cn('inline-block animate-spin rounded-full border-current border-t-transparent', spinnerSizeClasses[size], className)}
      {...props}
    />
  );
}

export interface LoadingProps extends SpinnerProps {
  label?: React.ReactNode;
}

/** Spinner with an optional inline label, useful for full-section loading states. */
export function Loading({ label, size = 'md', className, ...props }: LoadingProps) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-base-content/70', className)}>
      <Spinner size={size} {...props} />
      {label != null && <span>{label}</span>}
    </span>
  );
}
