import Link from 'next/link';
import React from 'react';
import { cn } from '@components/ui';

interface EntityNameLinkProps {
  children: React.ReactNode;
  /** Same target as the row's edit button. */
  href?: string;
  /** Same handler as the row's edit button, for entities edited in a modal. */
  onClick?: () => void;
  className?: string;
}

const interactiveClassName =
  'rounded-sm text-inherit underline-offset-2 transition-colors hover:text-primary hover:underline focus-visible:text-primary focus-visible:underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base-100 focus-visible:outline-none motion-reduce:transition-none';

/**
 * Entity name in a manage list that opens the same edit target as the row's edit button.
 * Without `href`/`onClick` (e.g. the role may not edit) it renders as plain text.
 */
export function EntityNameLink({ children, href, onClick, className }: EntityNameLinkProps) {
  if (href) {
    return (
      <Link href={href} className={cn(interactiveClassName, className)}>
        {children}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(interactiveClassName, 'cursor-pointer text-left', className)}>
        {children}
      </button>
    );
  }
  return <span className={className}>{children}</span>;
}
