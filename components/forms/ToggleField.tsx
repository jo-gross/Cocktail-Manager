import React, { useId } from 'react';
import { cn, Toggle, type ToggleProps } from '@components/ui';

export interface ToggleFieldProps extends Omit<ToggleProps, 'onChange' | 'checked'> {
  label: React.ReactNode;
  hint?: React.ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

/** Switch with its label as one touch target (min. 44px high). */
export function ToggleField({ label, hint, checked, onCheckedChange, className, id, ...toggleProps }: ToggleFieldProps) {
  const generatedId = useId();
  const toggleId = id ?? generatedId;
  return (
    <label htmlFor={toggleId} className={cn('inline-flex min-h-11 cursor-pointer items-center gap-3 select-none', className)}>
      <Toggle id={toggleId} checked={checked} onChange={(event) => onCheckedChange(event.target.checked)} {...toggleProps} />
      <span className="flex flex-col">
        <span className="text-sm">{label}</span>
        {hint ? <span className="text-xs text-base-content/60">{hint}</span> : null}
      </span>
    </label>
  );
}
