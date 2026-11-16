import Link from 'next/link';
import React from 'react';
import { FaChevronRight } from 'react-icons/fa';
import { Badge, Card, cn } from '@components/ui';
import { tourTarget as tourTargetProps, type TourTargetId } from '@lib/tours/targets';

interface ManageLinkProps {
  title: string;
  description?: string;
  icon?: React.JSX.Element;
  link: string;
  /** Tour anchor (`data-tour`) on the link. */
  tourTarget?: TourTargetId;
  /** Small badge next to the title, e.g. "Neu" for an announced feature tour. */
  badge?: string;
}

/** One row of a {@link ManageGroup}: icon, title, short description and chevron; the whole row is a single link. */
export function ManageLink(props: ManageLinkProps) {
  return (
    <li>
      <Link
        href={props.link}
        {...(props.tourTarget ? tourTargetProps(props.tourTarget) : {})}
        className={cn(
          'group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-base-200/60 motion-reduce:transition-none md:px-5',
          'focus-visible:bg-base-200/60 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none focus-visible:ring-inset',
        )}
      >
        {props.icon && (
          <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-base-200 text-lg text-base-content/70">
            {props.icon}
          </span>
        )}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-2 font-medium text-base-content">
            {props.title}
            {props.badge && (
              <Badge variant="primary" size="sm">
                {props.badge}
              </Badge>
            )}
          </span>
          {props.description && <span className="truncate text-sm text-base-content/60">{props.description}</span>}
        </span>
        <FaChevronRight aria-hidden="true" className="shrink-0 text-xs text-base-content/30 transition-colors group-hover:text-base-content/60" />
      </Link>
    </li>
  );
}

interface ManageGroupProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

/** Labelled card with a divided list of {@link ManageLink}s (same visual language as the settings sections). */
export function ManageGroup(props: ManageGroupProps) {
  const headingId = React.useId();
  return (
    <section aria-labelledby={headingId} className={cn('flex flex-col gap-2', props.className)}>
      <h2 id={headingId} className="px-1 text-sm font-semibold text-base-content/60">
        {props.title}
      </h2>
      <Card className="overflow-hidden">
        <ul className="divide-y divide-base-300">{props.children}</ul>
      </Card>
    </section>
  );
}
