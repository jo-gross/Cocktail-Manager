import React, { createContext, useContext } from 'react';
import { cn } from './cn';

export type DropdownAlign = 'start' | 'end';
export type DropdownPlacement = 'top' | 'bottom';

const DropdownContext = createContext<{ align: DropdownAlign; placement: DropdownPlacement }>({
  align: 'start',
  placement: 'bottom',
});

export interface DropdownProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: DropdownAlign;
  /** Where the menu opens relative to the trigger. */
  placement?: DropdownPlacement;
}

/**
 * Dropdown container. The first child is the trigger; a <DropdownContent> child
 * is revealed while the trigger or content has focus (CSS `focus-within`).
 */
export function Dropdown({ align = 'start', placement = 'bottom', className, children, ...props }: DropdownProps) {
  return (
    <DropdownContext.Provider value={{ align, placement }}>
      <div className={cn('group relative inline-block', className)} {...props}>
        {children}
      </div>
    </DropdownContext.Provider>
  );
}

export type DropdownContentProps = React.HTMLAttributes<HTMLDivElement>;

export function DropdownContent({ className, children, tabIndex = 0, ...props }: DropdownContentProps) {
  const { align, placement } = useContext(DropdownContext);
  return (
    <div
      tabIndex={tabIndex}
      className={cn(
        'invisible absolute z-50 min-w-[12rem] scale-95 rounded-lg border border-base-300 bg-base-100 p-1 opacity-0 shadow-lg transition-all duration-150 motion-reduce:transition-none',
        'group-focus-within:visible group-focus-within:scale-100 group-focus-within:opacity-100',
        align === 'end' ? 'right-0' : 'left-0',
        placement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export type MenuSize = 'sm' | 'md';

export interface MenuProps extends React.HTMLAttributes<HTMLUListElement> {
  size?: MenuSize;
}

export function Menu({ size = 'md', className, children, ...props }: MenuProps) {
  return (
    <ul className={cn('flex flex-col', size === 'sm' ? 'text-sm' : 'text-base', className)} {...props}>
      {children}
    </ul>
  );
}

export type MenuItemProps = React.LiHTMLAttributes<HTMLLIElement>;

export function MenuItem({ className, children, ...props }: MenuItemProps) {
  return (
    <li className={cn(className)} {...props}>
      {children}
    </li>
  );
}
