import React, { createContext, forwardRef, useContext } from 'react';
import { cn } from './cn';

export type TabsVariant = 'boxed' | 'bordered';

const TabsContext = createContext<{ variant: TabsVariant; fullWidth: boolean }>({
  variant: 'boxed',
  fullWidth: false,
});

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: TabsVariant;
  /** Stretch tabs to fill the container width. */
  fullWidth?: boolean;
}

export const Tabs = forwardRef<HTMLDivElement, TabsProps>(function Tabs({ variant = 'boxed', fullWidth = false, className, children, ...props }, ref) {
  return (
    <TabsContext.Provider value={{ variant, fullWidth }}>
      <div
        ref={ref}
        role="tablist"
        className={cn(
          'items-center gap-1',
          fullWidth ? 'flex w-full' : 'inline-flex',
          variant === 'boxed' ? 'rounded-lg bg-base-200 p-1' : 'border-b border-base-300',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </TabsContext.Provider>
  );
});

export interface TabProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  variant?: TabsVariant;
}

export const Tab = forwardRef<HTMLButtonElement, TabProps>(function Tab({ active = false, variant: variantProp, className, children, type, ...props }, ref) {
  const tabsContext = useContext(TabsContext);
  const variant = variantProp ?? tabsContext.variant;
  const fullWidth = tabsContext.fullWidth;

  return (
    <button
      ref={ref}
      role="tab"
      aria-selected={active}
      type={type ?? 'button'}
      className={cn(
        'cursor-pointer px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
        fullWidth && 'flex flex-1 justify-center',
        variant === 'boxed'
          ? cn('rounded-md', active ? 'bg-base-100 text-base-content shadow-sm' : 'text-base-content/60 hover:text-base-content')
          : cn('-mb-px border-b-2', active ? 'border-primary text-primary' : 'border-transparent text-base-content/60 hover:text-base-content'),
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});
