import React, { forwardRef } from 'react';
import { cn } from './cn';
import { Spinner } from './Loading';

export type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'neutral' | 'outline' | 'outline-error' | 'ghost' | 'error' | 'success' | 'info' | 'warning';
export type ButtonSize = 'xs' | 'sm' | 'md';
export type ButtonShape = 'default' | 'square' | 'circle';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  shape?: ButtonShape;
  /** Shows a spinner and disables the button. */
  loading?: boolean;
  /** Full width. */
  block?: boolean;
  /** Extra horizontal padding (DaisyUI `btn-wide` replacement). */
  wide?: boolean;
  /** Marks the button as part of a ButtonGroup so it drops inner rounding. */
  joinItem?: boolean;
}

const filledHoverClasses = 'hover:brightness-105 motion-reduce:hover:brightness-100';

const variantClasses: Record<ButtonVariant, string> = {
  primary: `bg-primary text-primary-content hover:bg-primary/90 focus-visible:ring-primary ${filledHoverClasses}`,
  secondary: `bg-secondary text-secondary-content hover:bg-secondary/90 focus-visible:ring-secondary ${filledHoverClasses}`,
  accent: `bg-accent text-accent-content hover:bg-accent/90 focus-visible:ring-accent ${filledHoverClasses}`,
  neutral: `bg-neutral text-neutral-content hover:bg-neutral/90 focus-visible:ring-neutral ${filledHoverClasses}`,
  outline: 'border border-base-300 bg-transparent text-base-content hover:bg-base-200 focus-visible:ring-base-300',
  'outline-error': 'border border-error bg-transparent text-error hover:bg-error/10 focus-visible:ring-error',
  ghost: 'bg-transparent text-base-content hover:bg-base-200 focus-visible:ring-base-300',
  error: `bg-error text-error-content hover:bg-error/90 focus-visible:ring-error ${filledHoverClasses}`,
  success: `bg-success text-success-content hover:bg-success/90 focus-visible:ring-success ${filledHoverClasses}`,
  info: `bg-info text-info-content hover:bg-info/90 focus-visible:ring-info ${filledHoverClasses}`,
  warning: `bg-warning text-warning-content hover:bg-warning/90 focus-visible:ring-warning ${filledHoverClasses}`,
};

const sizeClasses: Record<ButtonSize, string> = {
  xs: 'min-h-7 h-7 px-2 text-xs gap-1',
  sm: 'min-h-9 h-9 px-3 text-sm gap-1.5',
  md: 'min-h-11 h-11 px-4 text-sm gap-2',
};

const iconSizeClasses: Record<ButtonSize, string> = {
  xs: 'min-h-7 h-7 w-7 p-0',
  sm: 'min-h-9 h-9 w-9 p-0',
  md: 'min-h-11 h-11 w-11 p-0',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    shape = 'default',
    loading = false,
    block = false,
    wide = false,
    joinItem = false,
    disabled,
    className,
    children,
    type,
    ...props
  },
  ref,
) {
  const isIconShape = shape === 'square' || shape === 'circle';

  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      disabled={disabled || loading}
      className={cn(
        'inline-flex cursor-pointer items-center justify-center font-medium whitespace-nowrap transition-all duration-150 active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100',
        'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-base-100 focus-visible:outline-none',
        'disabled:pointer-events-none disabled:opacity-50',
        variantClasses[variant],
        isIconShape ? iconSizeClasses[size] : sizeClasses[size],
        // Rounding: skip when part of a group (the group rounds the outer corners).
        joinItem ? 'rounded-none focus:z-10' : shape === 'circle' ? 'rounded-full' : 'rounded-lg',
        wide && 'px-8',
        block && 'w-full',
        className,
      )}
      {...props}
    >
      {loading && <Spinner size="sm" className={cn(!isIconShape && children != null && 'mr-2')} />}
      {loading && isIconShape ? null : children}
    </button>
  );
});
