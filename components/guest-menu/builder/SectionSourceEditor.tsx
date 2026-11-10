/** Section source: all card groups / one card group / manual cocktails / rule (tags + ingredients). */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, cn, Input, Select } from '@components/ui';
import { resolveLocalizedText } from '@lib/guest-menu/localizedText';
import { RULE_SORTS, type SectionSource, type SectionSourceKind } from '@lib/guest-menu/schema';
import { useBuilder } from './BuilderContext';
import { CocktailPicker } from './CocktailPicker';
import { FieldRow, Segmented } from './controls';

const KINDS: SectionSourceKind[] = ['cardAllGroups', 'cardGroup', 'manual', 'rule'];

function defaultSource(kind: SectionSourceKind): SectionSource {
  switch (kind) {
    case 'cardAllGroups':
      return { kind };
    case 'cardGroup':
      return { kind, groupId: '' };
    case 'manual':
      return { kind, cocktailIds: [] };
    case 'rule':
      return { kind, tags: [], ingredientIds: [], logic: 'OR', sort: 'name' };
  }
}

function ChipSelect({
  options,
  selected,
  onChange,
  placeholder,
  disabled,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState('');
  const labels = useMemo(() => new Map(options.map((option) => [option.value, option.label])), [options]);
  const normalized = query.trim().toLowerCase();
  const available = options
    .filter((option) => !selected.includes(option.value) && (normalized === '' || option.label.toLowerCase().includes(normalized)))
    .slice(0, 40);
  return (
    <div className="flex flex-col gap-1.5">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((value) => (
            <button
              key={value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(selected.filter((entry) => entry !== value))}
              className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-content hover:opacity-80"
            >
              {labels.get(value) ?? value}
              <span aria-hidden className="ml-1">
                {'×'}
              </span>
            </button>
          ))}
        </div>
      )}
      {!disabled && (
        <>
          <Input
            inputSize="sm"
            type="search"
            placeholder={placeholder}
            aria-label={placeholder}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="flex max-h-32 flex-wrap gap-1 overflow-auto">
            {available.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onChange([...selected, option.value])}
                className="rounded-full border border-base-300 px-2 py-0.5 text-xs hover:bg-base-200"
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function SectionSourceEditor({ source, onChange }: { source: SectionSource; onChange: (source: SectionSource) => void }) {
  const { t } = useTranslation('guestMenu');
  const { menu, data, canEdit, primaryLocale } = useBuilder();

  const cardsForGroups = menu.sourceMode === 'FIXED_CARD' && menu.sourceCardId ? data.cards.filter((card) => card.id === menu.sourceCardId) : data.cards;
  const tagOptions = useMemo(
    () =>
      data.tagDefinitions.map((definition) => ({
        value: definition.tag,
        label: resolveLocalizedText(definition.label, primaryLocale, primaryLocale, definition.tag),
      })),
    [data.tagDefinitions, primaryLocale],
  );
  const ingredientOptions = useMemo(() => data.ingredients.map((ingredient) => ({ value: ingredient.id, label: ingredient.name })), [data.ingredients]);
  const usesCard = source.kind === 'cardAllGroups' || source.kind === 'cardGroup';

  return (
    <div className="flex flex-col gap-2">
      <FieldRow label={t('builder.source.kind')} htmlFor="gm-source-kind">
        <Select
          id="gm-source-kind"
          selectSize="sm"
          value={source.kind}
          disabled={!canEdit}
          onChange={(event) => onChange(defaultSource(event.target.value as SectionSourceKind))}
        >
          {KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {t(`builder.source.${kind}`)}
            </option>
          ))}
        </Select>
      </FieldRow>
      <p className="text-xs text-base-content/60">{t(`builder.source.${source.kind}Hint`)}</p>
      {usesCard && menu.sourceMode === 'NONE' && (
        <Alert variant="warning" className="py-2 text-xs">
          {t('builder.source.noSourceCard')}
        </Alert>
      )}

      {source.kind === 'cardGroup' && (
        <FieldRow
          label={t('builder.source.group')}
          htmlFor="gm-source-group"
          hint={menu.sourceMode === 'ACTIVE_CARD' ? t('builder.source.groupActiveCardHint') : undefined}
        >
          <Select
            id="gm-source-group"
            selectSize="sm"
            value={source.groupId}
            error={source.groupId === ''}
            disabled={!canEdit}
            onChange={(event) => onChange({ kind: 'cardGroup', groupId: event.target.value })}
          >
            <option value="">{t('builder.source.chooseGroup')}</option>
            {cardsForGroups.map((card) => (
              <optgroup key={card.id} label={card.name}>
                {[...card.groups]
                  .sort((a, b) => a.groupNumber - b.groupNumber)
                  .map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </Select>
        </FieldRow>
      )}

      {source.kind === 'manual' && <CocktailPicker value={source.cocktailIds} onChange={(cocktailIds) => onChange({ kind: 'manual', cocktailIds })} />}

      {source.kind === 'rule' && (
        <>
          <FieldRow label={t('builder.source.tags')}>
            <ChipSelect
              options={tagOptions}
              selected={source.tags}
              disabled={!canEdit}
              placeholder={t('builder.source.searchTags')}
              onChange={(tags) => onChange({ ...source, tags })}
            />
          </FieldRow>
          <FieldRow label={t('builder.source.ingredients')}>
            <ChipSelect
              options={ingredientOptions}
              selected={source.ingredientIds}
              disabled={!canEdit}
              placeholder={t('builder.source.searchIngredients')}
              onChange={(ingredientIds) => onChange({ ...source, ingredientIds })}
            />
          </FieldRow>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm">{t('builder.source.logic')}</span>
            <Segmented<'AND' | 'OR'>
              value={source.logic}
              size="xs"
              ariaLabel={t('builder.source.logic')}
              onChange={(logic) => canEdit && onChange({ ...source, logic })}
              options={[
                { value: 'OR', label: t('builder.source.logicOr') },
                { value: 'AND', label: t('builder.source.logicAnd') },
              ]}
            />
          </div>
          <div className={cn('flex flex-wrap items-center justify-between gap-2')}>
            <span className="text-sm">{t('builder.source.sort')}</span>
            <Segmented<(typeof RULE_SORTS)[number]>
              value={source.sort}
              size="xs"
              ariaLabel={t('builder.source.sort')}
              onChange={(sort) => canEdit && onChange({ ...source, sort })}
              options={RULE_SORTS.map((sort) => ({ value: sort, label: t(`builder.source.sorts.${sort}`) }))}
            />
          </div>
          {source.tags.length === 0 && source.ingredientIds.length === 0 && <p className="text-xs text-warning">{t('builder.source.ruleEmpty')}</p>}
        </>
      )}
    </div>
  );
}
