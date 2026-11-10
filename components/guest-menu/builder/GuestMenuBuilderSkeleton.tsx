import { useTranslation } from 'react-i18next';
import { Skeleton } from '@components/ui';

function TabSkeletons({ count }: { count: number }) {
  return (
    <div className="flex shrink-0 gap-3 overflow-hidden border-b border-base-300 px-3 py-3">
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} className="h-4 w-16 shrink-0" />
      ))}
    </div>
  );
}

function StructureSkeleton() {
  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-7 w-20" />
      </div>
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="flex items-center gap-2 rounded-lg border border-base-300 p-2">
          <Skeleton className="h-5 w-5 shrink-0" />
          <Skeleton className="h-4 min-w-0 flex-1" />
          <Skeleton className="h-5 w-16 shrink-0" />
        </div>
      ))}
    </div>
  );
}

function PreviewSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex justify-end px-3 pt-2">
        <Skeleton className="h-4 w-28" />
      </div>
      <div className="min-h-0 flex-1 overflow-hidden p-3">
        <div className="mx-auto aspect-[414/868] w-full max-w-[414px] rounded-[2.2rem] border border-base-300 bg-base-300/50 p-3 shadow-xl">
          <div className="h-full space-y-6 overflow-hidden rounded-[1.6rem] bg-base-100 p-5">
            <Skeleton className="mx-auto h-16 w-16" circle />
            <div className="space-y-3">
              <Skeleton className="mx-auto h-7 w-3/4" />
              <Skeleton className="mx-auto h-3 w-1/2" />
            </div>
            <Skeleton className="h-9 w-full" />
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="space-y-3 border-t border-base-300 pt-4">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function InspectorSkeleton() {
  return (
    <>
      <div className="space-y-2 border-b border-base-300 p-3">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </div>
      <div className="space-y-4 p-3">
        <Skeleton className="h-3 w-24" />
        {[0, 1].map((index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </div>
    </>
  );
}

/** Initial editor shell, shared by the route-parameter and menu-fetch states. */
export function GuestMenuBuilderSkeleton() {
  const { t } = useTranslation('guestMenu');

  return (
    <div className="flex h-dvh flex-col bg-base-200" aria-busy="true" aria-label={t('builder.loading')}>
      <span role="status" className="sr-only">
        {t('builder.loading')}
      </span>
      <div aria-hidden="true" className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 flex-col gap-2 border-b border-base-300 bg-base-100 px-2 py-2 md:px-3">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-8 w-8 shrink-0" />
            <div className="min-w-0 space-y-1.5">
              <Skeleton className="h-4 w-32 sm:w-48" />
              <Skeleton className="h-3 w-24" />
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-1">
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-8 w-8" />
              <Skeleton className="hidden h-8 w-8 sm:block" />
              <Skeleton className="hidden h-8 w-8 sm:block" />
              <Skeleton className="h-8 w-28" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-7 w-28" />
            <Skeleton className="hidden h-3 w-20 sm:block" />
            <Skeleton className="h-7 w-24" />
          </div>
        </div>

        {/* Match the editor's default structure/phone/inspector panes. */}
        <div className="hidden min-h-0 flex-1 lg:flex">
          <div className="flex min-h-0 w-[23rem] shrink-0 flex-col overflow-hidden border-r border-base-300 bg-base-100">
            <TabSkeletons count={6} />
            <StructureSkeleton />
          </div>
          <div className="min-w-0 flex-1">
            <PreviewSkeleton />
          </div>
          <div className="flex min-h-0 w-[22rem] shrink-0 flex-col overflow-hidden border-l border-base-300 bg-base-100">
            <TabSkeletons count={2} />
            <InspectorSkeleton />
          </div>
        </div>

        {/* Tablet and mobile initially show only the Edit tab, like the editor. */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-base-100 lg:hidden">
          <TabSkeletons count={4} />
          <TabSkeletons count={6} />
          <StructureSkeleton />
        </div>
      </div>
    </div>
  );
}
