/** Per-cocktail overrides of a section: hide, highlight, description, price and field overrides. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaChevronDown, FaChevronRight, FaEye, FaEyeSlash } from 'react-icons/fa';
import { Button, cn, Input, Select } from '@components/ui';
import { HIGHLIGHTS, resolveFieldConfig, type GuestMenuHighlight, type ItemOverride, type SectionBlock } from '@lib/guest-menu/schema';
import { useBuilder } from './BuilderContext';
import { FieldRow, LocalizedInput } from './controls';
import { FieldConfigEditor } from './FieldConfigEditor';

function isEmptyOverride(override: ItemOverride): boolean {
  return (
    !override.hidden &&
    !override.highlight &&
    override.price === undefined &&
    (!override.description || Object.keys(override.description).length === 0) &&
    (!override.fields || Object.keys(override.fields).length === 0)
  );
}

export function OverridesEditor({ block }: { block: SectionBlock }) {
  const { t } = useTranslation('guestMenu');
  const { updateBlock, preview, data, selection, canEdit, document, output } = useBuilder();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const rowRefs = useRef(new Map<string, HTMLLIElement>());

  // Items currently resolved for this section (preview) + cocktails that only exist as overrides (e.g. hidden).
  const rows = useMemo(() => {
    const entries = new Map<string, string>();
    for (const entry of preview?.dto.blocks ?? []) {
      if (entry.type === 'section' && entry.sourceBlockId === block.id) for (const item of entry.items) entries.set(item.id, item.name);
    }
    for (const id of Object.keys(block.overrides)) if (!entries.has(id)) entries.set(id, data.cocktailById.get(id)?.name ?? id);
    return [...entries.entries()].map(([id, name]) => ({ id, name }));
  }, [preview, block.id, block.overrides, data.cocktailById]);

  const selectedItem = selection?.blockId === block.id ? selection.itemId : null;
  useEffect(() => {
    if (!selectedItem) return;
    setExpanded(selectedItem);
    rowRefs.current.get(selectedItem)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedItem]);

  const setOverride = (cocktailId: string, patch: Partial<ItemOverride>, mergeKey?: string) =>
    updateBlock(
      block.id,
      (current) => {
        if (current.type !== 'section') return current;
        const next: ItemOverride = { ...(current.overrides[cocktailId] ?? {}), ...patch };
        for (const key of Object.keys(next) as (keyof ItemOverride)[]) if (next[key] === undefined) delete next[key];
        const overrides = { ...current.overrides };
        if (isEmptyOverride(next)) delete overrides[cocktailId];
        else overrides[cocktailId] = next;
        return { ...current, overrides };
      },
      mergeKey,
    );

  const normalized = filter.trim().toLowerCase();
  const visibleRows = rows.filter((row) => normalized === '' || row.name.toLowerCase().includes(normalized));
  const sectionFields = resolveFieldConfig(document, output, block.fields);

  if (rows.length === 0) return <p className="text-xs text-base-content/60">{t('builder.overrides.empty')}</p>;

  return (
    <div className="flex flex-col gap-2">
      {rows.length > 8 && (
        <Input
          inputSize="sm"
          type="search"
          placeholder={t('builder.overrides.filter')}
          aria-label={t('builder.overrides.filter')}
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
      )}
      <ul className="flex flex-col gap-1">
        {visibleRows.map((row) => {
          const override = block.overrides[row.id] ?? {};
          const open = expanded === row.id;
          const hasOverride = !isEmptyOverride(override);
          return (
            <li
              key={row.id}
              ref={(element) => {
                if (element) rowRefs.current.set(row.id, element);
                else rowRefs.current.delete(row.id);
              }}
              className={cn('rounded-md border', selectedItem === row.id ? 'border-primary' : 'border-base-300', override.hidden && 'opacity-60')}
            >
              <div className="flex items-center gap-1 px-1 py-1">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-1 text-left text-sm"
                  aria-expanded={open}
                  onClick={() => setExpanded(open ? null : row.id)}
                >
                  {open ? <FaChevronDown className="shrink-0 text-xs" /> : <FaChevronRight className="shrink-0 text-xs" />}
                  <span className={cn('truncate', override.hidden && 'line-through')}>{row.name}</span>
                  {hasOverride && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-info" title={t('builder.overridden')} />}
                </button>
                {override.highlight && (
                  <span className="rounded bg-accent px-1 text-[0.65rem] text-accent-content">{t(`builder.overrides.highlights.${override.highlight}`)}</span>
                )}
                <button
                  type="button"
                  disabled={!canEdit}
                  className="flex h-7 w-7 items-center justify-center rounded hover:bg-base-200"
                  title={override.hidden ? t('builder.overrides.show') : t('builder.overrides.hide')}
                  aria-label={override.hidden ? t('builder.overrides.show') : t('builder.overrides.hide')}
                  onClick={() => setOverride(row.id, { hidden: override.hidden ? undefined : true })}
                >
                  {override.hidden ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
              {open && (
                <div className="flex flex-col gap-2 border-t border-base-300 p-2">
                  <FieldRow label={t('builder.overrides.highlight')} htmlFor={`gm-ov-hl-${row.id}`}>
                    <Select
                      id={`gm-ov-hl-${row.id}`}
                      selectSize="sm"
                      value={override.highlight ?? ''}
                      disabled={!canEdit}
                      onChange={(event) => setOverride(row.id, { highlight: (event.target.value || undefined) as GuestMenuHighlight | undefined })}
                    >
                      <option value="">{t('builder.overrides.noHighlight')}</option>
                      {HIGHLIGHTS.map((highlight) => (
                        <option key={highlight} value={highlight}>
                          {t(`builder.overrides.highlights.${highlight}`)}
                        </option>
                      ))}
                    </Select>
                  </FieldRow>
                  <FieldRow label={t('builder.overrides.price')} htmlFor={`gm-ov-price-${row.id}`} hint={t('builder.overrides.priceHint')}>
                    <div className="flex gap-2">
                      <Input
                        id={`gm-ov-price-${row.id}`}
                        type="number"
                        min={0}
                        step="0.1"
                        inputSize="sm"
                        disabled={!canEdit || override.price === null}
                        value={override.price ?? ''}
                        onChange={(event) =>
                          setOverride(row.id, { price: event.target.value === '' ? undefined : Math.max(0, Number(event.target.value)) }, `ov-price-${row.id}`)
                        }
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant={override.price === null ? 'primary' : 'outline'}
                        disabled={!canEdit}
                        onClick={() => setOverride(row.id, { price: override.price === null ? undefined : null })}
                      >
                        {t('builder.overrides.hidePrice')}
                      </Button>
                    </div>
                  </FieldRow>
                  <FieldRow label={t('builder.overrides.description')}>
                    <LocalizedInput
                      multiline
                      rows={3}
                      value={override.description}
                      placeholder={t('builder.overrides.descriptionPlaceholder')}
                      onChange={(description) =>
                        setOverride(row.id, { description: Object.keys(description).length ? description : undefined }, `ov-desc-${row.id}`)
                      }
                    />
                  </FieldRow>
                  <details>
                    <summary className="cursor-pointer text-sm font-medium">{t('builder.overrides.fields')}</summary>
                    <FieldConfigEditor
                      idPrefix={`gm-ov-fields-${row.id}`}
                      value={override.fields ?? {}}
                      inherited={sectionFields}
                      output={output}
                      disabled={!canEdit}
                      onChange={(fields) => setOverride(row.id, { fields: Object.keys(fields).length ? fields : undefined })}
                    />
                  </details>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
