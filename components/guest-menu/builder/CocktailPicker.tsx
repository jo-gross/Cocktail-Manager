/** Searchable cocktail list for manual sections (selected list is drag-sortable). */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaPlus, FaTimes } from 'react-icons/fa';
import { Input } from '@components/ui';
import { useBuilder } from './BuilderContext';
import { DragHandle, SortableList } from './SortableList';

export function CocktailPicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const { t } = useTranslation('guestMenu');
  const { data, canEdit } = useBuilder();
  const [query, setQuery] = useState('');
  const selected = useMemo(() => new Set(value), [value]);

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return data.cocktails
      .filter((cocktail) => !selected.has(cocktail.id))
      .filter(
        (cocktail) =>
          normalized === '' || cocktail.name.toLowerCase().includes(normalized) || cocktail.tags.some((tag) => tag.toLowerCase().includes(normalized)),
      );
  }, [data.cocktails, query, selected]);

  return (
    <div className="flex flex-col gap-2">
      {value.length === 0 ? (
        <p className="text-xs text-base-content/60">{t('builder.source.manualEmpty')}</p>
      ) : (
        <SortableList
          items={value}
          getId={(id) => id}
          disabled={!canEdit}
          onReorder={onChange}
          renderItem={(id, handle) => (
            <div className="flex items-center gap-1 rounded-md border border-base-300 bg-base-100 px-1 text-sm">
              <DragHandle {...handle} label={t('builder.structure.drag')} />
              <span className="min-w-0 flex-1 truncate">{data.cocktailById.get(id)?.name ?? t('builder.source.unknownCocktail')}</span>
              {canEdit && (
                <button
                  type="button"
                  className="flex h-7 w-7 items-center justify-center rounded hover:bg-base-200"
                  aria-label={t('builder.source.removeCocktail')}
                  title={t('builder.source.removeCocktail')}
                  onClick={() => onChange(value.filter((entry) => entry !== id))}
                >
                  <FaTimes />
                </button>
              )}
            </div>
          )}
        />
      )}
      {canEdit && (
        <>
          <Input
            inputSize="sm"
            type="search"
            placeholder={t('builder.source.searchCocktails')}
            aria-label={t('builder.source.searchCocktails')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <ul className="flex max-h-56 flex-col overflow-auto rounded-md border border-base-300">
            {results.map((cocktail) => (
              <li key={cocktail.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-base-200"
                  onClick={() => onChange([...value, cocktail.id])}
                >
                  <FaPlus className="shrink-0 text-xs text-base-content/50" />
                  <span className="truncate">{cocktail.name}</span>
                </button>
              </li>
            ))}
            {results.length === 0 && <li className="px-2 py-2 text-xs text-base-content/60">{t('builder.source.noCocktails')}</li>}
          </ul>
        </>
      )}
    </div>
  );
}
