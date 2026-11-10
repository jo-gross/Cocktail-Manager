import React from 'react';
import { cn } from '@components/ui';

export interface CodeChipSelectProps<T extends string> {
  options: readonly T[];
  value: readonly T[];
  onChange: (value: T[]) => void;
  /** Visible chip label. */
  getLabel: (code: T) => string;
  /** Tooltip / accessible name (defaults to the label). */
  getTitle?: (code: T) => string;
  /** Small prefix such as the footnote letter/number. */
  getPrefix?: (code: T) => string;
  disabled?: boolean;
  size?: 'xs' | 'sm';
  className?: string;
  'aria-label'?: string;
}

/** Multi-select rendered as toggleable chips; keeps the order of `options`. */
export function CodeChipSelect<T extends string>(props: CodeChipSelectProps<T>) {
  const selected = new Set(props.value);
  const toggle = (code: T) => {
    const next = new Set(selected);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    props.onChange(props.options.filter((option) => next.has(option)));
  };

  return (
    <div role="group" aria-label={props['aria-label']} className={cn('flex flex-wrap gap-1', props.className)}>
      {props.options.map((code) => {
        const active = selected.has(code);
        const label = props.getLabel(code);
        return (
          <button
            key={code}
            type="button"
            aria-pressed={active}
            title={props.getTitle?.(code) ?? label}
            disabled={props.disabled}
            onClick={() => toggle(code)}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border transition-colors',
              'focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60',
              props.size === 'xs' ? 'h-6 px-2 text-xs' : 'h-7 px-2.5 text-sm',
              active ? 'border-primary bg-primary text-primary-content' : 'border-base-300 bg-base-100 text-base-content hover:bg-base-200',
            )}
          >
            {props.getPrefix && <span className={cn('font-mono text-[0.7em]', active ? 'opacity-80' : 'opacity-60')}>{props.getPrefix(code)}</span>}
            {label}
          </button>
        );
      })}
    </div>
  );
}
