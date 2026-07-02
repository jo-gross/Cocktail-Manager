import React from 'react';
import { cn } from './cn';

export type FormControlProps = React.HTMLAttributes<HTMLDivElement>;

/** Vertical form field wrapper (DaisyUI `form-control` replacement). */
export function FormControl({ className, children, ...props }: FormControlProps) {
  return (
    <div className={cn('flex w-full flex-col', className)} {...props}>
      {children}
    </div>
  );
}
