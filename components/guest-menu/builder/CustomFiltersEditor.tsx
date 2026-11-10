/** Self-defined guest filters: label + tags (match any), optionally shown as quick chip. */
import { useTranslation } from 'react-i18next';
import { FaArrowDown, FaArrowUp, FaPlus, FaTrashAlt } from 'react-icons/fa';
import { Button, Checkbox } from '@components/ui';
import { TagInput } from '@components/TagInput';
import { createBlockId, MAX_CUSTOM_FILTERS, type CustomFilter } from '@lib/guest-menu/schema';
import { useBuilder } from './BuilderContext';
import { FieldRow, LocalizedInput } from './controls';

interface CustomFiltersEditorProps {
  value: CustomFilter[];
  onChange: (filters: CustomFilter[], mergeKey?: string) => void;
}

export function CustomFiltersEditor({ value, onChange }: CustomFiltersEditorProps) {
  const { t } = useTranslation('guestMenu');
  const { canEdit } = useBuilder();

  const patch = (index: number, changes: Partial<CustomFilter>, mergeKey?: string) =>
    onChange(
      value.map((filter, i) => (i === index ? { ...filter, ...changes } : filter)),
      mergeKey,
    );
  const move = (index: number, delta: number) => {
    const next = [...value];
    const [entry] = next.splice(index, 1);
    next.splice(index + delta, 0, entry);
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-2">
      {value.length === 0 && <p className="text-xs text-base-content/60">{t('builder.customFilters.empty')}</p>}
      {value.map((filter, index) => (
        <div key={filter.id} className="flex flex-col gap-2 rounded-lg border border-base-300 p-2">
          <FieldRow label={t('builder.customFilters.label')}>
            <LocalizedInput value={filter.label} onChange={(label) => patch(index, { label }, `custom-filter-label-${filter.id}`)} />
          </FieldRow>
          <FieldRow label={t('builder.customFilters.tags')} hint={t('builder.customFilters.tagsHint')}>
            {canEdit ? (
              <TagInput value={filter.tags} validate={(tag) => /^[a-zäöüß0-9]+$/.test(tag.trim().toLowerCase())} onChange={(tags) => patch(index, { tags })} />
            ) : (
              <p className="text-sm">{filter.tags.join(', ')}</p>
            )}
          </FieldRow>
          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checkboxSize="sm"
                checked={filter.quick !== false}
                disabled={!canEdit}
                onChange={(event) => patch(index, { quick: event.target.checked })}
              />
              {t('builder.customFilters.quick')}
            </label>
            <div className="flex gap-1">
              <Button
                type="button"
                size="xs"
                variant="ghost"
                shape="square"
                aria-label={t('builder.customFilters.moveUp')}
                disabled={!canEdit || index === 0}
                onClick={() => move(index, -1)}
              >
                <FaArrowUp />
              </Button>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                shape="square"
                aria-label={t('builder.customFilters.moveDown')}
                disabled={!canEdit || index === value.length - 1}
                onClick={() => move(index, 1)}
              >
                <FaArrowDown />
              </Button>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                shape="square"
                className="text-error"
                aria-label={t('builder.customFilters.remove')}
                disabled={!canEdit}
                onClick={() => onChange(value.filter((_, i) => i !== index))}
              >
                <FaTrashAlt />
              </Button>
            </div>
          </div>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!canEdit || value.length >= MAX_CUSTOM_FILTERS}
        onClick={() => onChange([...value, { id: createBlockId('f'), label: {}, tags: [], quick: true }])}
      >
        <FaPlus /> {t('builder.customFilters.add')}
      </Button>
    </div>
  );
}
