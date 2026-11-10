import React, { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, cn, Skeleton } from '@components/ui';

interface SettingsSectionProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Header actions (e.g. "Add" button), aligned to the right on wider screens. */
  actions?: React.ReactNode;
  /** Footer, e.g. the section's save button. */
  footer?: React.ReactNode;
  /** Highlights the section as destructive (danger zone). */
  tone?: 'default' | 'danger';
  className?: string;
  children?: React.ReactNode;
}

/** Full-width settings card with a consistent header (title, description, actions), body and optional footer. */
export function SettingsSection({ title, description, actions, footer, tone = 'default', className, children }: SettingsSectionProps) {
  const headingId = useId();

  return (
    <Card className={cn(tone === 'danger' && 'border border-error/60', className)}>
      <section aria-labelledby={headingId} className="flex flex-col">
        <header className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between md:px-6 md:pt-5">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 id={headingId} className={cn('text-lg font-semibold', tone === 'danger' && 'text-error')}>
              {title}
            </h2>
            {description ? <div className="text-sm text-base-content/70">{description}</div> : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </header>
        {children ? <div className="flex flex-col gap-4 px-4 pb-4 md:px-6 md:pb-6">{children}</div> : null}
        {footer ? <div className="flex flex-wrap items-center justify-end gap-2 border-t border-base-300 px-4 py-3 md:px-6">{footer}</div> : null}
      </section>
    </Card>
  );
}

/** Skeleton placeholder with the same frame as {@link SettingsSection}, announced as loading. */
export function SettingsSectionSkeleton({ rows = 3, className }: { rows?: number; className?: string }) {
  const { t } = useTranslation(['common']);

  return (
    <Card className={className} aria-busy="true">
      <div className="flex flex-col gap-4 p-4 md:px-6 md:py-5">
        <span role="status" className="sr-only">
          {t('common:loadingShort')}
        </span>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    </Card>
  );
}
