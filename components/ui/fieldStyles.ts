import { cn } from './cn';

export interface FieldStyleOptions {
  error?: boolean;
  bordered?: boolean;
  joinItem?: boolean;
  extra?: string;
}

/** Shared visual styling for text-like form controls (input, textarea, select). */
export function fieldClassName({ error = false, bordered = true, joinItem = false, extra }: FieldStyleOptions = {}): string {
  return cn(
    'w-full bg-base-100 text-base-content transition-colors',
    'placeholder:text-base-content/40',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-base-100',
    bordered ? 'border' : 'border-0',
    joinItem ? 'rounded-none focus:z-10' : 'rounded-lg',
    error ? 'border-error focus-visible:ring-error' : 'border-base-300 focus-visible:ring-primary',
    'disabled:cursor-not-allowed disabled:opacity-60',
    extra,
  );
}
