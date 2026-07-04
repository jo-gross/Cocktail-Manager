import React from 'react';
import { cn } from './cn';

export type FieldErrorProps = React.HTMLAttributes<HTMLParagraphElement>;

/** Renders inline form validation errors. Renders nothing when there is no content. */
export function FieldError({ className, children, ...props }: FieldErrorProps) {
  if (children == null || children === false || children === '') return null;
  return (
    <p className={cn('mt-1 text-sm text-error', className)} {...props}>
      {children}
    </p>
  );
}
