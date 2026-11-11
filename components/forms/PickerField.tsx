import React, { forwardRef } from 'react';
import { FaChevronDown } from 'react-icons/fa';
import { cn, fieldClassName } from '@components/ui';

export interface PickerFieldProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'value'> {
  /** Display text of the selected entry. */
  value?: string | null;
  placeholder: string;
  error?: boolean;
  joinItem?: boolean;
}

/**
 * Looks like a field, is a button: opens a picker (e.g. a search modal). Unlike a read-only input it
 * neither shows a caret nor tries to open the on-screen keyboard on tablets.
 */
export const PickerField = forwardRef<HTMLButtonElement, PickerFieldProps>(function PickerField(
  { value, placeholder, error = false, joinItem = false, className, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-haspopup="dialog"
      data-invalid={error || undefined}
      className={cn(fieldClassName({ error, joinItem }), 'flex h-11 min-h-11 min-w-0 cursor-pointer items-center gap-2 px-3 text-left text-sm', className)}
      {...props}
    >
      <span className={cn('min-w-0 flex-1 truncate', !value && 'text-base-content/50')}>{value || placeholder}</span>
      <FaChevronDown aria-hidden className="shrink-0 text-xs text-base-content/40" />
    </button>
  );
});
