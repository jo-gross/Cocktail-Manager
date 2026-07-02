import React, { useMemo, useState } from 'react';
import { FaTimes } from 'react-icons/fa';
import { Button, Card, CardBody, CardTitle, Checkbox, Input, Loading, Select } from '@components/ui';

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
    const filtered = items.filter((item) => item.name.toLowerCase().includes(filter.toLowerCase()));

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
    <Card>
      <CardBody>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            Cocktails
            {loading && <Loading size="xs" />}
          </span>
          {selectedIds.size > 0 && onClear && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              title="Auswahl leeren"
            >
              <FaTimes />
            </Button>
          )}
        </CardTitle>

        <div className="flex flex-wrap gap-2">
          <Input type="text" placeholder="Filter..." inputSize="sm" className="w-full flex-1" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <Select selectSize="sm" className="w-fit" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)}>
            <option value="count-desc">↓ Bestellungen</option>
            <option value="count-asc">↑ Bestellungen</option>
            <option value="alpha-asc">A-Z</option>
            <option value="alpha-desc">Z-A</option>
          </Select>
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
                <Checkbox checked={selectedIds.has(item.id)} onChange={() => onToggleSelect(item.id)} onClick={(e) => e.stopPropagation()} />
              </div>
            </div>
          ))}
        </div>
        {sortedAndFilteredItems.length === 0 && <div className="py-4 text-center text-base-content/70">Keine Cocktails gefunden</div>}
      </CardBody>
    </Card>
  );
}
