import React, { createContext, useContext } from 'react';
import { cn } from './cn';
import { collapseContentPadding } from './layoutStyles';

interface CollapseContextValue {
  open: boolean;
  arrow: boolean;
}

const CollapseContext = createContext<CollapseContextValue>({ open: false, arrow: false });

export interface CollapseProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Controlled open state. When omitted the collapse renders closed. */
  open?: boolean;
  /** Shows a rotating chevron in the title. */
  arrow?: boolean;
}

/**
 * Controlled disclosure container. Compose with <CollapseTitle> (the clickable
 * header) and <CollapseContent> (revealed when `open`).
 */
export function Collapse({ open, arrow = false, className, children, ...props }: CollapseProps) {
  return (
    <CollapseContext.Provider value={{ open: open ?? false, arrow }}>
      <div className={cn('overflow-hidden rounded-lg border border-base-300/60 bg-base-200 shadow-sm', className)} {...props}>
        {children}
      </div>
    </CollapseContext.Provider>
  );
}

export type CollapseTitleProps = React.HTMLAttributes<HTMLDivElement>;

export function CollapseTitle({ className, children, ...props }: CollapseTitleProps) {
  const { open, arrow } = useContext(CollapseContext);
  return (
    <div className={cn('flex cursor-pointer items-center gap-2 px-3 py-3 transition-colors hover:bg-base-300/30 md:px-4', className)} {...props}>
      <div className="flex min-w-0 flex-1 items-center justify-between gap-2">{children}</div>
      {arrow && (
        <span className={cn('shrink-0 transition-transform duration-200 motion-reduce:transition-none', open && 'rotate-180')} aria-hidden>
          ▾
        </span>
      )}
    </div>
  );
}

export type CollapseContentProps = React.HTMLAttributes<HTMLDivElement>;

export function CollapseContent({ className, children, ...props }: CollapseContentProps) {
  const { open } = useContext(CollapseContext);
  return (
    <div className={cn('grid transition-[grid-template-rows] duration-200 motion-reduce:transition-none', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
      <div className="overflow-hidden">
        <div className={cn(collapseContentPadding, className)} {...props}>
          {children}
        </div>
      </div>
    </div>
  );
}

export type AccordionProps = React.HTMLAttributes<HTMLDivElement>;

export function Accordion({ className, children, ...props }: AccordionProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)} {...props}>
      {children}
    </div>
  );
}
