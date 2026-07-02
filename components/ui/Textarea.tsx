import React, { forwardRef } from 'react';
import { cn } from './cn';
import { fieldClassName } from './fieldStyles';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
  bordered?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { error = false, bordered = true, className, rows = 3, ...props },
  ref,
) {
  return <textarea ref={ref} rows={rows} className={cn(fieldClassName({ error, bordered }), 'min-h-[2.5rem] px-3 py-2 text-sm', className)} {...props} />;
});
