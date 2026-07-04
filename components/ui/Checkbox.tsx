import React, { forwardRef } from 'react';
import { cn } from './cn';

export type CheckboxSize = 'sm' | 'md';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'> {
  checkboxSize?: CheckboxSize;
}

const sizeClasses: Record<CheckboxSize, string> = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
};

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox({ checkboxSize = 'md', className, ...props }, ref) {
  return (
    <input
      ref={ref}
      type="checkbox"
      className={cn(
        'shrink-0 cursor-pointer rounded border border-base-300 bg-base-100 accent-primary',
        'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-base-100 focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-60',
        sizeClasses[checkboxSize],
        className,
      )}
      {...props}
    />
  );
});
