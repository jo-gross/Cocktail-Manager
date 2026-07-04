import React from 'react';
import { cn } from './cn';
import { TableCell, TableRow } from './Table';

export type SkeletonProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Render as a circle (e.g. avatars). */
  circle?: boolean;
};

/** Pulse placeholder for loading states. */
export function Skeleton({ circle = false, className, ...props }: SkeletonProps) {
  return (
    <div aria-hidden className={cn('animate-pulse bg-base-300 motion-reduce:animate-none', circle ? 'rounded-full' : 'rounded-lg', className)} {...props} />
  );
}

export interface SkeletonTableRowsProps {
  columns: number;
  rows?: number;
  /** Column index (0-based) that renders a square avatar placeholder. Pass -1 to disable. */
  avatarColumn?: number;
}

/** Skeleton rows for table loading states. */
export function SkeletonTableRows({ columns, rows = 5, avatarColumn = 1 }: SkeletonTableRowsProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <TableRow key={`skeleton-row-${rowIndex}`}>
          {Array.from({ length: columns }).map((_, colIndex) => (
            <TableCell key={`skeleton-row-${rowIndex}-col-${colIndex}`}>
              {avatarColumn >= 0 && colIndex === avatarColumn ? (
                <Skeleton className="h-14 w-14 rounded-lg" />
              ) : (
                <Skeleton className="h-4 w-full max-w-[12rem]" />
              )}
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}
