import React, { forwardRef } from 'react';
import { cn } from './cn';

export type BadgeVariant = 'neutral' | 'primary' | 'secondary' | 'accent' | 'info' | 'success' | 'warning' | 'error' | 'ghost';
export type BadgeSize = 'xs' | 'sm' | 'md' | 'lg';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  /** Outlined style: colored border/text on a transparent background. */
  outline?: boolean;
}

const solidClasses: Record<BadgeVariant, string> = {
  neutral: 'bg-neutral text-neutral-content',
  primary: 'bg-primary text-primary-content',
  secondary: 'bg-secondary text-secondary-content',
  accent: 'bg-accent text-accent-content',
  info: 'bg-info text-info-content',
  success: 'bg-success text-success-content',
  warning: 'bg-warning text-warning-content',
  error: 'bg-error text-error-content',
  ghost: 'bg-base-200 text-base-content',
};

const outlineClasses: Record<BadgeVariant, string> = {
  neutral: 'border border-neutral text-base-content',
  primary: 'border border-primary text-primary',
  secondary: 'border border-secondary text-secondary',
  accent: 'border border-accent text-accent',
  info: 'border border-info text-info',
  success: 'border border-success text-success',
  warning: 'border border-warning text-warning',
  error: 'border border-error text-error',
  ghost: 'border border-base-300 text-base-content',
};

const sizeClasses: Record<BadgeSize, string> = {
  xs: 'h-4 px-1.5 text-[0.65rem]',
  sm: 'h-5 px-2 text-xs',
  md: 'h-6 px-2.5 text-xs',
  lg: 'h-7 px-3 text-sm',
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { variant = 'neutral', size = 'md', outline = false, className, children, ...props },
  ref,
) {
  return (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium',
        outline ? outlineClasses[variant] : solidClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
});
