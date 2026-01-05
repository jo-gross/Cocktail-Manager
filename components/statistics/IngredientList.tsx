import React, {useMemo, useState} from 'react';
import {FaTimes} from 'react-icons/fa';

type SortOption = 'count-desc' | 'count-asc' | 'alpha-asc' | 'alpha-desc';

interface IngredientListItem {
  ingredient: string;
  count: number;
  cocktailCount: number;
  percentage: number;
}

interface IngredientListProps {
  items: IngredientListItem[];
  selectedIds?: Set<string>;
  onToggleSelect?: (ingredient: string) => void;
  onClear?: () => void;
  loading?: boolean;
}

export function IngredientList({ items, selectedIds = new Set(), onToggleSelect, onClear, loading }: IngredientListProps) {
  const [filter, setFilter] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('count-desc');

  const sortedAndFilteredItems = useMemo(() => {
    let filtered = items.filter((item) => item.ingredient.toLowerCase().includes(filter.toLowerCase()));

    switch (sortBy) {
      case 'count-desc':
        return filtered.sort((a, b) => b.count - a.count || a.ingredient.localeCompare(b.ingredient));
      case 'count-asc':
        return filtered.sort((a, b) => a.count - b.count || a.ingredient.localeCompare(b.ingredient));
      case 'alpha-asc':
        return filtered.sort((a, b) => a.ingredient.localeCompare(b.ingredient));
      case 'alpha-desc':
        return filtered.sort((a, b) => b.ingredient.localeCompare(a.ingredient));
      default:
        return filtered;
    }
  }, [items, filter, sortBy]);

  return (
    <div className="card">
      <div className="card-body">
        <div className="card-title flex items-center justify-between">
          <span className="flex items-center gap-2">
            Zutaten
            {loading && <span className="loading loading-spinner loading-xs"></span>}
          </span>
          {selectedIds.size > 0 && onClear && (
            <button
              className="btn btn-ghost btn-xs"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              title="Auswahl leeren"
            >
              <FaTimes />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Filter..."
            className="input input-sm input-bordered w-full flex-1"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <select className="select select-bordered select-sm w-fit" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)}>
            <option value="count-desc">↓ Bestellungen</option>
            <option value="count-asc">↑ Bestellungen</option>
            <option value="alpha-asc">A-Z</option>
            <option value="alpha-desc">Z-A</option>
          </select>
        </div>

        <div className="max-h-[60vh] space-y-2 overflow-y-auto">
          {sortedAndFilteredItems.map((item) => (
            <div
              key={item.ingredient}
              className={`cursor-pointer rounded-lg border-2 p-3 transition-colors ${
                selectedIds.has(item.ingredient) ? 'border-primary bg-primary/10' : 'border-base-300'
              }`}
              onClick={() => onToggleSelect?.(item.ingredient)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{item.ingredient}</div>
                  <div className="text-sm text-base-content/70">
                    {item.count} Bestellungen · {item.cocktailCount} Cocktails
                  </div>
                </div>
                {onToggleSelect && (
                  <input
                    type="checkbox"
                    className="checkbox-primary checkbox"
                    checked={selectedIds.has(item.ingredient)}
                    onChange={() => onToggleSelect(item.ingredient)}
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
        {sortedAndFilteredItems.length === 0 && <div className="py-4 text-center text-base-content/70">Keine Zutaten gefunden</div>}
      </div>
    </div>
  );
}
