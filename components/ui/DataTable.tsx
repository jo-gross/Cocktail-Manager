import React from 'react';
import { DataTableContext } from './dataTableContext';
import { cn } from './cn';
import { TableCell } from './Table';

export { useDataTableContext } from './dataTableContext';

export interface DataTableProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Toolbar slot (e.g. search field) rendered above the bordered table. */
  toolbar?: React.ReactNode;
  /** Shown below the table when there are no rows. */
  emptyState?: React.ReactNode;
  /** Max height class for the scrollable table body area. */
  maxHeight?: string;
  /** Stretch the table area to fill remaining vertical space in a flex parent. */
  fillHeight?: boolean;
}

/** Bordered table container with sticky header and row hover styling via Table subcomponents. */
export function DataTable({ className, toolbar, children, emptyState, maxHeight = 'max-h-[70vh]', fillHeight = false, ...props }: DataTableProps) {
  return (
    <div className={cn('flex flex-col gap-3', fillHeight && 'min-h-0 flex-1', className)} {...props}>
      {toolbar != null ? <div className="rounded-lg border border-base-300/40 bg-base-200/50 p-3">{toolbar}</div> : null}
      <DataTableContext.Provider value={true}>
        <div className={cn('overflow-hidden rounded-xl border border-base-300/60', fillHeight && 'flex min-h-0 flex-1 flex-col')}>
          <div className={cn('overflow-x-auto overflow-y-auto', fillHeight ? 'min-h-0 flex-1' : maxHeight)}>{children}</div>
          {emptyState}
        </div>
      </DataTableContext.Provider>
    </div>
  );
}

export interface TableImageCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  hasImage?: boolean;
  onImageClick?: () => void;
}

/** Fixed-size image cell with placeholder for uniform row height. */
export function TableImageCell({ hasImage = false, onImageClick, className, children, ...props }: TableImageCellProps) {
  return (
    <TableCell className={cn('relative z-0 w-0 p-2', className)} {...props}>
      <div
        className={cn('flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg', hasImage ? 'cursor-pointer' : 'bg-base-200/50')}
        onClick={hasImage ? onImageClick : undefined}
        role={hasImage && onImageClick ? 'button' : undefined}
        tabIndex={hasImage && onImageClick ? 0 : undefined}
        onKeyDown={
          hasImage && onImageClick
            ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onImageClick();
                }
              }
            : undefined
        }
      >
        {hasImage ? children : null}
      </div>
    </TableCell>
  );
}
