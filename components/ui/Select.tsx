import React, { forwardRef } from 'react';
import { cn } from './cn';
import { fieldClassName } from './fieldStyles';

export type SelectSize = 'sm' | 'md';

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  error?: boolean;
  bordered?: boolean;
  joinItem?: boolean;
  selectSize?: SelectSize;
}

const selectSizeClasses: Record<SelectSize, string> = {
  sm: 'min-h-9 h-9 pl-2.5 pr-8 text-sm',
  md: 'min-h-11 h-11 pl-3 pr-9 text-sm',
};

/** Native <select> styled to match the other form controls. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { error = false, bordered = true, joinItem = false, selectSize = 'md', className, children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(fieldClassName({ error, bordered, joinItem }), selectSizeClasses[selectSize], 'cursor-pointer bg-base-100', className)}
      {...props}
    >
      {children}
    </select>
  );
});
