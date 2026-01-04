import React, { useState } from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import '@lib/StringUtils';

interface CocktailListItem {
  cocktailId: string;
  name: string;
  count: number;
  percentage: number;
  delta: number;
  rank: number;
}

interface CocktailListProps {
  items: CocktailListItem[];
  selectedId?: string;
  onSelect: (cocktailId: string) => void;
  hiddenIds?: Set<string>;
  onToggleHidden?: (cocktailId: string) => void;
  loading?: boolean;
}

export function CocktailList({ items, selectedId, onSelect, hiddenIds = new Set(), onToggleHidden, loading }: CocktailListProps) {
  const [sortBy, setSortBy] = useState<'name' | 'count' | 'percentage' | 'rank'>('count');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [filter, setFilter] = useState('');
  const [showHidden, setShowHidden] = useState(false);

  const filteredItems = items.filter((item) => item.name.toLowerCase().includes(filter.toLowerCase()));

  // Sort all items together to maintain order
  const sortedItems = [...filteredItems].sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'count':
        comparison = a.count - b.count;
        break;
      case 'percentage':
        comparison = a.percentage - b.percentage;
        break;
      case 'rank':
        comparison = a.rank - b.rank;
        break;
    }
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const handleSort = (newSortBy: typeof sortBy) => {
    if (sortBy === newSortBy) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortDirection('desc');
    }
  };

  if (loading) {
    return (
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <div className="text-center text-base-content/70">Lade...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="card-title text-lg">Cocktails</h3>
        </div>

        <input type="text" placeholder="Filter..." className="input input-sm input-bordered mb-4" value={filter} onChange={(e) => setFilter(e.target.value)} />

        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>
                  <button className="btn btn-ghost btn-xs" onClick={() => handleSort('rank')}>
                    Rang {sortBy === 'rank' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </button>
                </th>
                <th>Farbe</th>
                <th>
                  <button className="btn btn-ghost btn-xs" onClick={() => handleSort('name')}>
                    Name {sortBy === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </button>
                </th>
                <th>
                  <button className="btn btn-ghost btn-xs" onClick={() => handleSort('count')}>
                    Anzahl {sortBy === 'count' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </button>
                </th>
                <th>
                  <button className="btn btn-ghost btn-xs" onClick={() => handleSort('percentage')}>
                    Anteil {sortBy === 'percentage' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </button>
                </th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((item) => {
                const isHidden = hiddenIds.has(item.cocktailId);
                return (
                  <tr
                    key={item.cocktailId}
                    className={`${selectedId === item.cocktailId ? 'active' : ''} ${isHidden ? 'opacity-50' : ''}`}
                    onClick={() => onSelect(item.cocktailId)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>#{item.rank}</td>
                    <td>
                      <div className="h-4 w-4 rounded" style={{ backgroundColor: item.name.string2color() }} title={item.name} />
                    </td>
                    <td className="font-semibold">{item.name}</td>
                    <td>{item.count}</td>
                    <td>{item.percentage.toFixed(1)}%</td>
                    <td>
                      {onToggleHidden && (
                        <button
                          className="btn btn-ghost btn-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleHidden(item.cocktailId);
                          }}
                          title={isHidden ? 'Einblenden' : 'Ausblenden'}
                        >
                          {isHidden ? <FaEyeSlash /> : <FaEye />}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {sortedItems.length === 0 && <div className="py-4 text-center text-base-content/70">Keine Cocktails gefunden</div>}
      </div>
    </div>
  );
}
