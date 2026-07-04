import React, { forwardRef } from 'react';
import { cn } from './cn';

export type AlertVariant = 'info' | 'success' | 'warning' | 'error' | 'neutral';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  icon?: React.ReactNode;
}

// Each variant uses a solid, fully opaque background (the variant color) paired
// with its readable `-content` text token, so the alert stands out clearly on
// base-100/base-200 surfaces in both light and dark themes.
const variantClasses: Record<AlertVariant, string> = {
  info: 'border-info bg-info text-info-content',
  success: 'border-success bg-success text-success-content',
  warning: 'border-warning bg-warning text-warning-content',
  error: 'border-error bg-error text-error-content',
  neutral: 'border-neutral bg-neutral text-neutral-content',
};

const iconVariantClasses: Record<AlertVariant, string> = {
  info: 'text-info-content',
  success: 'text-success-content',
  warning: 'text-warning-content',
  error: 'text-error-content',
  neutral: 'text-neutral-content',
};

export const Alert = forwardRef<HTMLDivElement, AlertProps>(function Alert({ variant = 'info', icon, className, children, ...props }, ref) {
  return (
    <div
      ref={ref}
      role="alert"
      className={cn(
        'flex animate-fade-in items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-sm motion-reduce:animate-none',
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {icon != null && (
        // `h-5` matches the `text-sm` line height so the icon stays centered on
        // the first line of text, even when the content wraps to multiple lines.
        <span className={cn('flex h-5 shrink-0 items-center text-lg leading-none', iconVariantClasses[variant])}>{icon}</span>
      )}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
});
