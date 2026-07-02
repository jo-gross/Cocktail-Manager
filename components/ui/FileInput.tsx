import React from 'react';
import { cn } from './cn';

export interface FileInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  bordered?: boolean;
}

export const FileInput = React.forwardRef<HTMLInputElement, FileInputProps>(function FileInput({ bordered = true, className, ...props }, ref) {
  return (
    <input
      ref={ref}
      type="file"
      className={cn(
        'w-full cursor-pointer rounded-field bg-base-100 px-3 py-2 text-sm text-base-content',
        'file:mr-3 file:cursor-pointer file:rounded-field file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-content',
        'hover:file:bg-primary/90',
        'disabled:cursor-not-allowed disabled:opacity-50',
        bordered && 'border border-base-content/20',
        className,
      )}
      {...props}
    />
  );
});
