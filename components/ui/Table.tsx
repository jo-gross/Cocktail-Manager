import React, { forwardRef } from 'react';
import { FaSort, FaSortDown, FaSortUp } from 'react-icons/fa';
import { useDataTableContext } from './dataTableContext';
import { cn } from './cn';
import type { SortDirection } from './useSortableData';

export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  /** Zebra striping for body rows. */
  zebra?: boolean;
  /** Tighter cell padding (DaisyUI `table-xs`/`table-sm` replacement). */
  compact?: boolean;
  /** Enable row hover highlight. */
  hoverable?: boolean;
  /** Enforce a minimum row height (3.5rem). */
  minRowHeight?: boolean;
}

export const Table = forwardRef<HTMLTableElement, TableProps>(function Table(
  { zebra = false, compact = false, hoverable, minRowHeight, className, children, ...props },
  ref,
) {
  const inDataTable = useDataTableContext();
  const rowHover = hoverable ?? inDataTable;
  const minHeight = minRowHeight ?? inDataTable;

  return (
    <table
      ref={ref}
      className={cn(
        'w-full border-collapse text-left text-sm',
        zebra && '[&_tbody_tr:nth-child(even)]:bg-base-200/40',
        rowHover && '[&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-base-200/40',
        minHeight && '[&_tbody_tr]:min-h-14 [&_td]:min-h-14',
        compact && '[&_td]:px-2 [&_td]:py-1 [&_th]:px-2 [&_th]:py-1',
        'print:border',
        className,
      )}
      {...props}
    >
      {children}
    </table>
  );
});

export const TableHead = forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(function TableHead(
  { className, children, ...props },
  ref,
) {
  const inDataTable = useDataTableContext();

  return (
    <thead
      ref={ref}
      className={cn(
        'bg-base-100 text-left',
        inDataTable && 'sticky top-0 z-10 border-b-2 border-base-300 bg-base-300/95 backdrop-blur-sm',
        !inDataTable && 'border-b-2 border-base-300 bg-base-300/80 backdrop-blur-sm',
        className,
      )}
      {...props}
    >
      {children}
    </thead>
  );
});

export const TableBody = forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(function TableBody(
  { className, children, ...props },
  ref,
) {
  return (
    <tbody ref={ref} className={cn(className)} {...props}>
      {children}
    </tbody>
  );
});

export const TableRow = forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(function TableRow({ className, children, ...props }, ref) {
  const inDataTable = useDataTableContext();

  return (
    <tr ref={ref} className={cn('border-b border-base-300/50', inDataTable && 'min-h-14 transition-colors hover:bg-base-200/40', className)} {...props}>
      {children}
    </tr>
  );
});

export const TableHeaderCell = forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(function TableHeaderCell(
  { className, children, ...props },
  ref,
) {
  return (
    <th ref={ref} className={cn('px-3 py-3 text-left text-xs font-semibold tracking-wide text-base-content/70 uppercase', className)} {...props}>
      {children}
    </th>
  );
});

export interface SortableHeaderCellProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  sortKey: string;
  activeSortKey: string;
  direction: SortDirection;
  onSort: (sortKey: string) => void;
}

export const SortableHeaderCell = forwardRef<HTMLTableCellElement, SortableHeaderCellProps>(function SortableHeaderCell(
  { sortKey, activeSortKey, direction, onSort, className, children, ...props },
  ref,
) {
  const isActive = activeSortKey === sortKey;
  const ariaSort = isActive ? (direction === 'asc' ? 'ascending' : 'descending') : 'none';

  return (
    <th
      ref={ref}
      role="columnheader"
      aria-sort={ariaSort}
      className={cn(
        'cursor-pointer px-3 py-3 text-left text-xs font-semibold tracking-wide text-base-content/70 uppercase transition-colors select-none hover:text-base-content',
        isActive && 'text-base-content',
        className,
      )}
      onClick={() => onSort(sortKey)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSort(sortKey);
        }
      }}
      tabIndex={0}
      {...props}
    >
      <span className="inline-flex items-center gap-1.5">
        {children}
        {isActive ? (
          direction === 'asc' ? (
            <FaSortUp className="shrink-0 text-primary" aria-hidden />
          ) : (
            <FaSortDown className="shrink-0 text-primary" aria-hidden />
          )
        ) : (
          <FaSort className="shrink-0 opacity-40" aria-hidden />
        )}
      </span>
    </th>
  );
});

export const TableCell = forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(function TableCell(
  { className, children, ...props },
  ref,
) {
  return (
    <td ref={ref} className={cn('px-3 py-2 align-middle', className)} {...props}>
      {children}
    </td>
  );
});
