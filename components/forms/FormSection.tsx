import React, { useId, useState } from 'react';
import { FaChevronDown } from 'react-icons/fa';
import { Card, cn } from '@components/ui';

export interface FormSectionProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Header actions (e.g. "Add" button), aligned to the right on wider screens. */
  actions?: React.ReactNode;
  /** Footer, e.g. the section's save button. */
  footer?: React.ReactNode;
  /** Highlights the section as destructive (danger zone). */
  tone?: 'default' | 'danger';
  /** Anchor for the {@link EntityFormLayout} section navigation. */
  id?: string;
  /** Header becomes a toggle; for optional / advanced settings. */
  collapsible?: boolean;
  defaultOpen?: boolean;
  /** Keeps a collapsible section open (e.g. while it contains a validation error). */
  forceOpen?: boolean;
  /** Shown next to the title, e.g. a status badge of a collapsed section. */
  badge?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Card section with a consistent header (title, description, actions), body and optional footer.
 * The one building block for entity forms and settings pages.
 */
export function FormSection({
  title,
  description,
  actions,
  footer,
  tone = 'default',
  id,
  collapsible = false,
  defaultOpen = false,
  forceOpen = false,
  badge,
  className,
  children,
}: FormSectionProps) {
  const headingId = useId();
  const bodyId = useId();
  const [openState, setOpenState] = useState(defaultOpen);
  const open = !collapsible || openState || forceOpen;

  const heading = (
    <div className="flex min-w-0 flex-col gap-1">
      <h2 id={headingId} className={cn('flex flex-wrap items-center gap-2 text-lg font-semibold', tone === 'danger' && 'text-error')}>
        {title}
        {badge}
      </h2>
      {description ? <div className="text-sm font-normal text-base-content/70">{description}</div> : null}
    </div>
  );

  return (
    <Card id={id} className={cn(tone === 'danger' && 'border border-error/60', className)}>
      <section aria-labelledby={headingId} className="flex flex-col">
        {collapsible ? (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => setOpenState(!open)}
            className="flex min-h-11 w-full cursor-pointer items-start justify-between gap-3 p-4 text-left transition-colors hover:bg-base-300/30 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none focus-visible:ring-inset md:px-6 md:py-5"
          >
            {heading}
            <FaChevronDown
              aria-hidden
              className={cn('mt-1.5 shrink-0 text-sm text-base-content/60 transition-transform motion-reduce:transition-none', open && 'rotate-180')}
            />
          </button>
        ) : (
          <header className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between md:px-6 md:pt-5">
            {heading}
            {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
          </header>
        )}
        {/* Container: field grids inside a section adapt to the section's width (`@xl:grid-cols-2`, …). */}
        {children ? (
          <div id={bodyId} hidden={!open} className={cn('@container flex flex-col gap-4 px-4 pb-4 md:px-6 md:pb-6', !open && 'hidden')}>
            {children}
          </div>
        ) : null}
        {footer && open ? <div className="flex flex-wrap items-center justify-end gap-2 border-t border-base-300 px-4 py-3 md:px-6">{footer}</div> : null}
      </section>
    </Card>
  );
}
