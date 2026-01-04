import React, { useState, useMemo } from 'react';
import { FaTimes } from 'react-icons/fa';

type SortOption = 'count-desc' | 'count-asc' | 'alpha-asc' | 'alpha-desc';

interface CocktailItem {
  id: string;
  name: string;
  count: number;
}

interface AnalysisCocktailSelectorProps {
  items: CocktailItem[];
  selectedIds: Set<string>;
  onToggleSelect: (cocktailId: string) => void;
  onClear?: () => void;
  loading?: boolean;
}

export function AnalysisCocktailSelector({ items, selectedIds, onToggleSelect, onClear, loading }: AnalysisCocktailSelectorProps) {
  const [filter, setFilter] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('count-desc');

  const sortedAndFilteredItems = useMemo(() => {
    let filtered = items.filter((item) => item.name.toLowerCase().includes(filter.toLowerCase()));

    switch (sortBy) {
      case 'count-desc':
        return filtered.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
      case 'count-asc':
        return filtered.sort((a, b) => a.count - b.count || a.name.localeCompare(b.name));
      case 'alpha-asc':
        return filtered.sort((a, b) => a.name.localeCompare(b.name));
      case 'alpha-desc':
        return filtered.sort((a, b) => b.name.localeCompare(a.name));
      default:
        return filtered;
    }
  }, [items, filter, sortBy]);

  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body">
        <div className="card-title mb-4 flex items-center justify-between text-lg">
          <span className="flex items-center gap-2">
            Cocktails
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

        <div className="mb-4 flex gap-2">
          <input
            type="text"
            placeholder="Filter..."
            className="input input-sm input-bordered flex-1"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <select className="select select-bordered select-sm" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)}>
            <option value="count-desc">↓ Bestellungen</option>
            <option value="count-asc">↑ Bestellungen</option>
            <option value="alpha-asc">A-Z</option>
            <option value="alpha-desc">Z-A</option>
          </select>
        </div>

        <div className="max-h-[60vh] space-y-2 overflow-y-auto">
          {sortedAndFilteredItems.map((item) => (
            <div
              key={item.id}
              className={`cursor-pointer rounded-lg border-2 p-3 transition-colors ${
                selectedIds.has(item.id) ? 'border-primary bg-primary/10' : 'border-base-300'
              }`}
              onClick={() => onToggleSelect(item.id)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{item.name}</div>
                  <div className="text-sm text-base-content/70">{item.count} Bestellungen</div>
                </div>
                <input
                  type="checkbox"
                  className="checkbox-primary checkbox"
                  checked={selectedIds.has(item.id)}
                  onChange={() => onToggleSelect(item.id)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          ))}
        </div>
        {sortedAndFilteredItems.length === 0 && <div className="py-4 text-center text-base-content/70">Keine Cocktails gefunden</div>}
      </div>
    </div>
  );
}
