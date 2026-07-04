import React from 'react';
import { cn } from './cn';

export type DividerSize = 'sm' | 'md';

export interface DividerProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical';
  /** `sm` reduces the surrounding margin (DaisyUI `divider-sm` replacement). */
  size?: DividerSize;
}

/** Content divider, optionally with a centered label passed as children. */
export function Divider({ orientation = 'horizontal', size = 'md', className, children, ...props }: DividerProps) {
  if (orientation === 'vertical') {
    return <div className={cn('mx-2 w-px self-stretch bg-base-300', className)} {...props} />;
  }

  return (
    <div
      className={cn('flex items-center text-sm text-base-content/60', size === 'sm' ? 'my-0.5' : 'my-3', children != null ? 'gap-3' : '', className)}
      {...props}
    >
      <span className="h-px flex-1 bg-base-300" />
      {children != null && <span className="shrink-0">{children}</span>}
      {children != null && <span className="h-px flex-1 bg-base-300" />}
    </div>
  );
}
