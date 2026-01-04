import React from 'react';

interface InfoCardProps {
  label: string;
  value: number | string;
  formatValue?: (value: number | string) => string;
  unit?: string;
  className?: string;
}

export function InfoCard({ label, value, formatValue, unit, className = '' }: InfoCardProps) {
  const formatNumber = (val: number | string): string => {
    if (typeof val === 'string') return val;
    if (formatValue) return formatValue(val);
    return val.toLocaleString('de-DE');
  };

  const displayValue = formatNumber(value);
  const hasUnit = unit && typeof value === 'number' && value !== 0;

  return (
    <div className={`card bg-base-100 shadow-md transition-shadow hover:shadow-lg ${className}`}>
      <div className="card-body p-5">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-base-content/60">{label}</h4>
        <div className="flex items-baseline gap-2">
          <div className="text-3xl font-bold text-base-content">{displayValue}</div>
          {hasUnit && <span className="text-sm font-medium text-base-content/60">{unit}</span>}
        </div>
      </div>
    </div>
  );
}
