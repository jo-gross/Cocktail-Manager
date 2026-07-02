import React, { forwardRef } from 'react';
import { cn } from './cn';
import { fieldClassName } from './fieldStyles';

export type InputSize = 'sm' | 'md';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  error?: boolean;
  bordered?: boolean;
  joinItem?: boolean;
  inputSize?: InputSize;
}

const inputSizeClasses: Record<InputSize, string> = {
  sm: 'min-h-9 h-9 px-2.5 text-sm',
  md: 'min-h-11 h-11 px-3 text-sm',
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { error = false, bordered = true, joinItem = false, inputSize = 'md', className, type, ...props },
  ref,
) {
  return (
    <input ref={ref} type={type ?? 'text'} className={cn(fieldClassName({ error, bordered, joinItem }), inputSizeClasses[inputSize], className)} {...props} />
  );
});
