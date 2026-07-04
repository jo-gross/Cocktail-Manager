import React, { useState } from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import '@lib/StringUtils';
import { Button, Card, CardBody, Input, Loading, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@components/ui';

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
  const [_showHidden, _setShowHidden] = useState(false);

  const filteredItems = items.filter((item) => item.name.toLowerCase().includes(filter.toLowerCase()));

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
      <Card>
        <CardBody>
          <div className="text-center text-base-content/70">Lade...</div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            Cocktails
            {loading && <Loading size="xs" />}
          </span>
        </div>

        <Input type="text" placeholder="Filter..." inputSize="sm" value={filter} onChange={(e) => setFilter(e.target.value)} />

        <div className="overflow-x-auto">
          <Table compact>
            <TableHead>
              <TableRow>
                <TableHeaderCell>
                  <Button type="button" variant="ghost" size="xs" onClick={() => handleSort('rank')}>
                    Rang {sortBy === 'rank' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </Button>
                </TableHeaderCell>
                <TableHeaderCell>Farbe</TableHeaderCell>
                <TableHeaderCell>
                  <Button type="button" variant="ghost" size="xs" onClick={() => handleSort('name')}>
                    Name {sortBy === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </Button>
                </TableHeaderCell>
                <TableHeaderCell>
                  <Button type="button" variant="ghost" size="xs" onClick={() => handleSort('count')}>
                    Anzahl {sortBy === 'count' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </Button>
                </TableHeaderCell>
                <TableHeaderCell>
                  <Button type="button" variant="ghost" size="xs" onClick={() => handleSort('percentage')}>
                    Anteil {sortBy === 'percentage' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </Button>
                </TableHeaderCell>
                <TableHeaderCell>Aktionen</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedItems.map((item) => {
                const isHidden = hiddenIds.has(item.cocktailId);
                return (
                  <TableRow
                    key={item.cocktailId}
                    className={`${selectedId === item.cocktailId ? 'bg-primary/10' : ''} ${isHidden ? 'opacity-50' : ''}`}
                    onClick={() => onSelect(item.cocktailId)}
                    style={{ cursor: 'pointer' }}
                  >
                    <TableCell>#{item.rank}</TableCell>
                    <TableCell>
                      <div className="h-4 w-4 rounded" style={{ backgroundColor: item.name.string2color() }} title={item.name} />
                    </TableCell>
                    <TableCell className="font-semibold">{item.name}</TableCell>
                    <TableCell>{item.count}</TableCell>
                    <TableCell>{item.percentage.toFixed(1)}%</TableCell>
                    <TableCell>
                      {onToggleHidden && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleHidden(item.cocktailId);
                          }}
                          title={isHidden ? 'Einblenden' : 'Ausblenden'}
                        >
                          {isHidden ? <FaEyeSlash /> : <FaEye />}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {sortedItems.length === 0 && <div className="py-4 text-center text-base-content/70">Keine Cocktails gefunden</div>}
      </CardBody>
    </Card>
  );
}
