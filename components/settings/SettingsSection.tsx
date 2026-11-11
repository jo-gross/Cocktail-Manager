import React from 'react';
import { FormSection } from '@components/forms/FormSection';
import { useTranslation } from 'react-i18next';
import { Card, Skeleton } from '@components/ui';

/** Settings card – the same {@link FormSection} the entity forms use, so both areas share one visual language. */
export const SettingsSection = FormSection;

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
