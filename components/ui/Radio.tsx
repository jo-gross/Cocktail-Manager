import React, { forwardRef } from 'react';
import { cn } from './cn';

export type RadioSize = 'sm' | 'md';

export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  radioSize?: RadioSize;
}

const sizeClasses: Record<RadioSize, string> = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
};

export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio({ radioSize = 'md', className, ...props }, ref) {
  return (
    <input
      ref={ref}
      type="radio"
      className={cn(
        'shrink-0 cursor-pointer border border-base-300 bg-base-100 accent-primary',
        'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-base-100 focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-60',
        sizeClasses[radioSize],
        className,
      )}
      {...props}
    />
  );
});
