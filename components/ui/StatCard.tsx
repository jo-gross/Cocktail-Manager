import React from 'react';
import { Badge } from './Badge';
import { cn } from './cn';
import { Skeleton } from './Skeleton';

export interface StatCardProps {
  title: string;
  value: number | string;
  desc?: string | React.ReactNode;
  delta?: number;
  previousValue?: number | string;
  previousPeriodLabel?: string;
  formatValue?: (value: number | string) => string;
  className?: string;
  loading?: boolean;
}

/** Metric card with optional delta vs. a previous period and a loading state. */
export function StatCard({ title, value, desc, delta, previousValue, previousPeriodLabel, formatValue, className = '', loading = false }: StatCardProps) {
  const formatNumber = (val: number | string): string => {
    if (typeof val === 'string') return val;
    if (formatValue) return formatValue(val);
    return val.toLocaleString('de-DE');
  };

  const displayValue = formatNumber(value);
  const displayDelta = delta !== undefined ? delta.toFixed(1) : null;
  const isPositive = delta !== undefined && delta > 0;
  const isNegative = delta !== undefined && delta < 0;

  const deltaBadge =
    delta !== undefined ? (
      <Badge variant={isPositive ? 'success' : isNegative ? 'error' : 'neutral'} size="sm" outline className="w-fit font-medium">
        {isPositive ? '↗︎' : isNegative ? '↘︎' : '→'} {Math.abs(Number(displayDelta))}%
        {previousValue !== undefined && (
          <>
            {' '}
            vs. {formatNumber(previousValue)}
            {previousPeriodLabel && ` (${previousPeriodLabel})`}
          </>
        )}
      </Badge>
    ) : null;

  const footerContent = deltaBadge || desc;

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-2xl border border-base-300/60 bg-base-100 p-5 shadow-md transition-opacity duration-200',
        loading && 'motion-reduce:transition-none',
        className,
      )}
    >
      <div className="text-xs font-medium tracking-wide text-base-content/50 uppercase">{title}</div>
      <div className="text-3xl font-bold text-base-content">{loading ? <Skeleton className="h-9 w-28" /> : displayValue}</div>
      <div className="min-h-5 text-sm text-base-content/70">
        {loading ? <Skeleton className="h-5 w-36" /> : footerContent ? footerContent : <span className="opacity-0">.</span>}
      </div>
    </div>
  );
}
