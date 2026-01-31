import React, { useEffect, useState } from 'react';
import { getEndOfDay, getStartOfDay, getStartOfMonth, getStartOfWeek, getStartOfYear } from '@lib/dateHelpers';

export type TimeRangePreset = 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'allTime' | 'custom';

export interface TimeRange {
  startDate: Date;
  endDate: Date;
  preset?: TimeRangePreset;
}

interface TimeRangePickerProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
  showComparison?: boolean;
  comparisonValue?: TimeRange;
  onComparisonChange?: (range: TimeRange) => void;
  allowAllTime?: boolean;
  compact?: boolean;
  dayStartTime?: string;
}

function getPresetRange(preset: TimeRangePreset, dayStartTime?: string): { start: Date; end: Date } {
  const now = new Date();
  const today = getStartOfDay(now, dayStartTime);
  const todayEnd = getEndOfDay(now, dayStartTime);

  switch (preset) {
    case 'today':
      return { start: today, end: todayEnd };
    case 'yesterday': {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { start: getStartOfDay(yesterday, dayStartTime), end: getEndOfDay(yesterday, dayStartTime) };
    }
    case 'thisWeek': {
      const weekStart = getStartOfWeek(now, dayStartTime);
      return { start: weekStart, end: todayEnd };
    }
    case 'lastWeek': {
      const weekStart = getStartOfWeek(now, dayStartTime);
      const lastWeekStart = new Date(weekStart);
      lastWeekStart.setDate(lastWeekStart.getDate() - 7);
      const lastWeekEnd = new Date(weekStart);
      lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);
      return { start: getStartOfDay(lastWeekStart, dayStartTime), end: getEndOfDay(lastWeekEnd, dayStartTime) };
    }
    case 'thisMonth': {
      const monthStart = getStartOfMonth(now, dayStartTime);
      return { start: monthStart, end: todayEnd };
    }
    case 'lastMonth': {
      const monthStart = getStartOfMonth(now, dayStartTime);
      const lastMonthStart = new Date(monthStart);
      lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
      const lastMonthEnd = new Date(monthStart);
      lastMonthEnd.setDate(0); // Last day of previous month
      return { start: getStartOfDay(lastMonthStart, dayStartTime), end: getEndOfDay(lastMonthEnd, dayStartTime) };
    }
    case 'thisYear': {
      const yearStart = getStartOfYear(now, dayStartTime);
      return { start: yearStart, end: todayEnd };
    }
    case 'allTime':
      // Return a very early date to now
      return { start: new Date(0), end: todayEnd };
    default:
      return { start: today, end: todayEnd };
  }
}

/** Parse YYYY-MM-DD as local date at noon so getLogicalDate/dayStartTime does not shift to previous day */
function parseDateStringLocal(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

function formatDateRange(startDate: Date, endDate: Date): string {
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const start = formatDate(startDate);
  const end = formatDate(endDate);

  // If same day, show only one date
  if (start === end) {
    return start;
  }

  return `${start} - ${end}`;
}

function formatDateTimeRange(startDate: Date, endDate: Date): string {
  const formatDateTime = (date: Date) => {
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return `${formatDateTime(startDate)} – ${formatDateTime(endDate)}`;
}

export function TimeRangePicker({
  value,
  onChange,
  showComparison = false,
  comparisonValue,
  onComparisonChange,
  allowAllTime = false,
  compact = false,
  dayStartTime,
}: TimeRangePickerProps) {
  const [preset, setPreset] = useState<TimeRangePreset>(value.preset || 'thisWeek');
  const [isCustom, setIsCustom] = useState(value.preset === 'custom');
  const [customStart, setCustomStart] = useState(value.startDate.toISOString().split('T')[0]);
  const [customEnd, setCustomEnd] = useState(value.endDate.toISOString().split('T')[0]);

  // Update local state when value prop changes
  useEffect(() => {
    if (value.preset) {
      setPreset(value.preset);
      setIsCustom(value.preset === 'custom');
    }
    setCustomStart(value.startDate.toISOString().split('T')[0]);
    setCustomEnd(value.endDate.toISOString().split('T')[0]);
  }, [value.startDate.getTime(), value.endDate.getTime(), value.preset]);

  useEffect(() => {
    if (!isCustom && preset !== 'custom') {
      const range = getPresetRange(preset, dayStartTime);
      onChange({ startDate: range.start, endDate: range.end, preset });
    }
  }, [preset, isCustom, onChange, dayStartTime]);

  const handlePresetChange = (newPreset: TimeRangePreset) => {
    if (newPreset === 'custom') {
      setIsCustom(true);
      setPreset('custom');
    } else {
      setIsCustom(false);
      setPreset(newPreset);
      const range = getPresetRange(newPreset, dayStartTime);
      onChange({ startDate: range.start, endDate: range.end, preset: newPreset });
    }
  };

  const applyCustomRange = (overrides?: { start?: string; end?: string }) => {
    const startStr = overrides?.start ?? customStart;
    const endStr = overrides?.end ?? customEnd;
    if (!startStr || !endStr) return;
    const start = getStartOfDay(parseDateStringLocal(startStr), dayStartTime);
    const end = getEndOfDay(parseDateStringLocal(endStr), dayStartTime);
    if (start.getTime() <= end.getTime()) {
      onChange({ startDate: start, endDate: end, preset: 'custom' });
    }
  };

  const presets: Array<{ value: TimeRangePreset; label: string }> = [
    { value: 'today', label: 'Heute' },
    { value: 'yesterday', label: 'Gestern' },
    { value: 'thisWeek', label: 'Diese Woche' },
    { value: 'lastWeek', label: 'Letzte Woche' },
    { value: 'thisMonth', label: 'Dieser Monat' },
    { value: 'lastMonth', label: 'Letzter Monat' },
    { value: 'thisYear', label: 'Dieses Jahr (YTD)' },
  ];

  if (allowAllTime) {
    presets.push({ value: 'allTime', label: 'Gesamte Zeit' });
  }

  presets.push({ value: 'custom', label: 'Benutzerdefiniert…' });

  if (compact) {
    return (
      <div className="dropdown dropdown-end">
        <div tabIndex={0} role="button" className="btn btn-ghost gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <span className="hidden sm:inline">{formatDateRange(value.startDate, value.endDate)}</span>
        </div>
        <div tabIndex={0} className="menu dropdown-content z-[1000] w-[calc(100vw-2rem)] rounded-box bg-base-100 p-4 shadow-lg md:w-80">
          <div className="flex flex-col gap-3">
            <div className="text-sm font-semibold">Zeitraum auswählen</div>
            <select className="select select-bordered select-sm w-full" value={preset} onChange={(e) => handlePresetChange(e.target.value as TimeRangePreset)}>
              {presets.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>

            {isCustom && (
              <div className="flex flex-col gap-2">
                <label className="text-xs text-base-content/70">Von</label>
                <input
                  type="date"
                  className="input input-sm input-bordered w-full"
                  value={customStart}
                  onChange={(e) => {
                    const newStart = e.target.value;
                    setCustomStart(newStart);
                    const start = parseDateStringLocal(newStart);
                    const end = parseDateStringLocal(customEnd);
                    const newEnd = start.getTime() > end.getTime() ? newStart : customEnd;
                    if (start.getTime() > end.getTime()) {
                      setCustomEnd(newStart);
                    }
                    applyCustomRange({ start: newStart, end: newEnd });
                  }}
                />
                <label className="text-xs text-base-content/70">Bis</label>
                <input
                  type="date"
                  className="input input-sm input-bordered w-full"
                  value={customEnd}
                  onChange={(e) => {
                    const newEnd = e.target.value;
                    setCustomEnd(newEnd);
                    const start = parseDateStringLocal(customStart);
                    const end = parseDateStringLocal(newEnd);
                    const newStart = end.getTime() < start.getTime() ? newEnd : customStart;
                    if (end.getTime() < start.getTime()) {
                      setCustomStart(newEnd);
                    }
                    applyCustomRange({ start: newStart, end: newEnd });
                  }}
                />
              </div>
            )}

            <div className="divider-sm"></div>

            <div className="text-xs text-base-content/70">
              <div className="mb-1 font-medium">Gewählter Zeitraum:</div>
              <div>{formatDateTimeRange(value.startDate, value.endDate)}</div>
            </div>

            {dayStartTime && dayStartTime !== '00:00' && (
              <div className="flex items-center gap-1 text-xs text-base-content/50">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Tagesstart: {dayStartTime} Uhr
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <select className="select select-bordered select-sm" value={preset} onChange={(e) => handlePresetChange(e.target.value as TimeRangePreset)}>
          {presets.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>

        {isCustom && (
          <>
            <input
              type="date"
              className="input input-sm input-bordered"
              value={customStart}
              onChange={(e) => {
                const newStart = e.target.value;
                setCustomStart(newStart);
                const start = parseDateStringLocal(newStart);
                const end = parseDateStringLocal(customEnd);
                const newEnd = start.getTime() > end.getTime() ? newStart : customEnd;
                if (start.getTime() > end.getTime()) {
                  setCustomEnd(newStart);
                }
                applyCustomRange({ start: newStart, end: newEnd });
              }}
            />
            <span className="text-sm">bis</span>
            <input
              type="date"
              className="input input-sm input-bordered"
              value={customEnd}
              onChange={(e) => {
                const newEnd = e.target.value;
                setCustomEnd(newEnd);
                const start = parseDateStringLocal(customStart);
                const end = parseDateStringLocal(newEnd);
                const newStart = end.getTime() < start.getTime() ? newEnd : customStart;
                if (end.getTime() < start.getTime()) {
                  setCustomStart(newEnd);
                }
                applyCustomRange({ start: newStart, end: newEnd });
              }}
            />
          </>
        )}
      </div>

      {showComparison && comparisonValue && onComparisonChange && (
        <div className="text-xs text-base-content/70">
          Vergleichszeitraum: {comparisonValue.startDate.toLocaleDateString('de-DE')} - {comparisonValue.endDate.toLocaleDateString('de-DE')}
        </div>
      )}
    </div>
  );
}
