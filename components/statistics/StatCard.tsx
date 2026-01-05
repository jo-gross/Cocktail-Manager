import React from 'react';

interface StatCardProps {
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

  const deltaDesc =
    delta !== undefined ? (
      <span className={`${isPositive ? 'text-success' : isNegative ? 'text-error' : 'text-base-content/70'}`}>
        {isPositive ? '↗︎' : isNegative ? '↘︎' : '→'} {Math.abs(Number(displayDelta))}%
        {previousValue !== undefined && (
          <>
            {' '}
            vs. {formatNumber(previousValue)}
            {previousPeriodLabel && ` (${previousPeriodLabel})`}
          </>
        )}
      </span>
    ) : null;

  return (
    <div className={`stat bg-base-200 ${className}`}>
      <div className="stat-title">{title}</div>
      <div className="stat-value">{loading ? <div className="skeleton h-8 w-24"></div> : displayValue}</div>
      <div className="stat-desc">{loading ? <div className="skeleton mt-1 h-4 w-40"></div> : deltaDesc || desc || <span className="opacity-0">.</span>}</div>
    </div>
  );
}
