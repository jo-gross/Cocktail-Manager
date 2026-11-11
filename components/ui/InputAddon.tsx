import React from 'react';
import { cn } from './cn';

export type InputAddonProps = React.HTMLAttributes<HTMLSpanElement>;

/** Non-interactive prefix/suffix (unit, currency) for an input inside a <ButtonGroup>. */
export function InputAddon({ className, children, ...props }: InputAddonProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center border border-base-300 bg-base-200 px-3 text-sm whitespace-nowrap text-base-content/70 select-none',
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
