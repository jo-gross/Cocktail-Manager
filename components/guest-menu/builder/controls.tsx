/** Small shared form controls for the guest menu builder panels. */
import React, { useId, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { FaDesktop, FaMobileAlt, FaPrint } from 'react-icons/fa';
import { Badge, Button, cn, Input, Textarea } from '@components/ui';
import { GUEST_MENU_OUTPUTS, type Block, type GuestMenuOutput, type LocalizedText } from '@lib/guest-menu/schema';
import { isOutputVisible, setLocalized, setOutputVisible } from '@lib/guest-menu/builder';
import { useBuilder } from './BuilderContext';

export function PanelSection({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('flex flex-col gap-2 border-b border-base-300 px-3 py-3 last:border-b-0', className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-2">
          {title && <h3 className="text-xs font-semibold tracking-wide text-base-content/60 uppercase">{title}</h3>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function FieldRow({
  label,
  hint,
  children,
  htmlFor,
  inline,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  htmlFor?: string;
  inline?: boolean;
}) {
  return (
    <div className={cn('flex gap-1', inline ? 'flex-row items-center justify-between gap-3' : 'flex-col')}>
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-base-content/60">{hint}</p>}
    </div>
  );
}

export function useLanguageName() {
  const { i18n } = useTranslation();
  return (locale: string) => {
    try {
      return new Intl.DisplayNames([i18n.language || 'de'], { type: 'language' }).of(locale) ?? locale;
    } catch {
      return locale.toUpperCase();
    }
  };
}

interface LocalizedInputProps {
  value: LocalizedText | null | undefined;
  onChange: (value: LocalizedText) => void;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  id?: string;
  className?: string;
  monospace?: boolean;
}

/** Edits `value[locale]` for the builder's current locale; shows the primary-locale fallback greyed out. */
export function LocalizedInput({ value, onChange, multiline, rows = 4, placeholder, id, className, monospace }: LocalizedInputProps) {
  const { t } = useTranslation('guestMenu');
  const { locale, primaryLocale } = useBuilder();
  const current = value?.[locale] ?? '';
  const fallback = locale !== primaryLocale ? (value?.[primaryLocale] ?? '') : '';
  const showFallback = current === '' && fallback !== '';
  const common = {
    id,
    value: current,
    placeholder: showFallback ? fallback : placeholder,
    className: cn('w-full', showFallback && 'placeholder:text-base-content/40 placeholder:italic', monospace && 'font-mono text-xs', className),
  };
  return (
    <div className="flex flex-col gap-1">
      {multiline ? (
        <Textarea {...common} rows={rows} onChange={(event) => onChange(setLocalized(value, locale, event.target.value))} />
      ) : (
        <Input {...common} inputSize="sm" onChange={(event) => onChange(setLocalized(value, locale, event.target.value))} />
      )}
      {showFallback && <span className="text-xs text-base-content/50">{t('builder.locale.fallbackHint', { locale: primaryLocale.toUpperCase() })}</span>}
    </div>
  );
}

export const OUTPUT_ICONS: Record<GuestMenuOutput, ReactNode> = {
  web: <FaMobileAlt />,
  monitor: <FaDesktop />,
  print: <FaPrint />,
};

/** Per-block output visibility (web/monitor/print). */
export function OutputVisibilityToggles({ block, compact }: { block: Block; compact?: boolean }) {
  const { t } = useTranslation('guestMenu');
  const { updateBlock, canEdit } = useBuilder();
  return (
    <div className="flex items-center gap-1">
      {GUEST_MENU_OUTPUTS.map((output) => {
        const visible = isOutputVisible(block, output);
        const label = t(visible ? 'builder.visibility.visibleIn' : 'builder.visibility.hiddenIn', { output: t(`outputs.${output}`) });
        return (
          <button
            key={output}
            type="button"
            disabled={!canEdit}
            title={label}
            aria-label={label}
            aria-pressed={visible}
            onClick={(event) => {
              event.stopPropagation();
              updateBlock(block.id, (current) => setOutputVisible(current, output, !visible));
            }}
            className={cn(
              'flex items-center justify-center rounded-md border transition-colors',
              compact ? 'h-6 w-6 text-[0.7rem]' : 'h-8 w-8 text-sm',
              visible ? 'border-base-300 bg-base-100 text-base-content' : 'border-dashed border-base-300 text-base-content/30 line-through',
            )}
          >
            {OUTPUT_ICONS[output]}
          </button>
        );
      })}
    </div>
  );
}

/** Reads an image file, scales it down (canvas) and returns a data URL. */
export function readImageAsDataUrl(file: File, maxEdge: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const source = String(reader.result);
      if (file.type === 'image/svg+xml') return resolve(source);
      const image = new Image();
      image.onerror = () => reject(new Error('Invalid image'));
      image.onload = () => {
        const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
        if (scale === 1 && file.size < 800_000) return resolve(source);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        const context = canvas.getContext('2d');
        if (!context) return resolve(source);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/webp', 0.86));
      };
      image.src = source;
    };
    reader.readAsDataURL(file);
  });
}

/** Image upload stored inline (data URL, served via the public menu-asset endpoint). */
export function ImagePicker({
  value,
  onChange,
  maxEdge = 1600,
  label,
}: {
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  maxEdge?: number;
  label: string;
}) {
  const { t } = useTranslation('guestMenu');
  const { canEdit } = useBuilder();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border border-base-300 bg-base-200">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-contain" />
          ) : (
            <span className="text-xs text-base-content/50">{t('builder.image.none')}</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" loading={busy} disabled={!canEdit} onClick={() => inputRef.current?.click()}>
            {value ? t('builder.image.replace') : t('builder.image.upload')}
          </Button>
          {value && (
            <Button type="button" size="sm" variant="ghost" disabled={!canEdit} onClick={() => onChange(null)}>
              {t('builder.image.remove')}
            </Button>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          setBusy(true);
          setError(null);
          try {
            const dataUrl = await readImageAsDataUrl(file, maxEdge);
            if (dataUrl.length > 4_900_000) setError(t('builder.image.tooLarge'));
            else onChange(dataUrl);
          } catch {
            setError(t('builder.image.invalid'));
          } finally {
            setBusy(false);
          }
        }}
      />
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}

export function InheritBadge({ overridden, onReset }: { overridden: boolean; onReset?: () => void }) {
  const { t } = useTranslation('guestMenu');
  if (!overridden) {
    return (
      <Badge size="xs" variant="ghost">
        {t('builder.inherits')}
      </Badge>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <Badge size="xs" variant="info">
        {t('builder.overridden')}
      </Badge>
      {onReset && (
        <button type="button" className="text-xs underline opacity-70 hover:opacity-100" onClick={onReset}>
          {t('builder.reset')}
        </button>
      )}
    </span>
  );
}

/** Segmented button group (single choice). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = 'sm',
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (value: T) => void;
  size?: 'xs' | 'sm';
  ariaLabel?: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex items-center gap-0.5 rounded-lg bg-base-200 p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          title={option.title}
          aria-label={option.title}
          onClick={() => onChange(option.value)}
          className={cn(
            'flex items-center gap-1 rounded-md font-medium whitespace-nowrap transition-colors',
            size === 'xs' ? 'px-2 py-1 text-xs' : 'px-2.5 py-1.5 text-sm',
            value === option.value ? 'bg-base-100 text-base-content shadow-sm' : 'text-base-content/60 hover:text-base-content',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
