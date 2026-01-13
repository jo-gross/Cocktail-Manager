import React, { useContext, useState } from 'react';
import '@lib/StringUtils';
import { FaInfoCircle } from 'react-icons/fa';
import { ModalContext } from '@lib/context/ModalContextProvider';
import CocktailOrderTimesModal from '@components/modals/CocktailOrderTimesModal';

interface AnalysisCocktailDetail {
  total: number;
  previousTotal?: number;
  rank: number;
  avgPerActiveHour: number;
  revenue?: number;
  previousRevenue?: number;
  delta?: number;
}

interface AnalysisCocktail {
  id: string;
  name: string;
}

interface AnalysisCocktailTableProps {
  cocktails: AnalysisCocktail[];
  details: Map<string, AnalysisCocktailDetail>;
  totalRevenue: number;
  previousTotalRevenue?: number;
  workspaceId?: string;
  startDate?: Date;
  endDate?: Date;
}

export function AnalysisCocktailTable({ cocktails, details, totalRevenue, previousTotalRevenue = 0, workspaceId, startDate, endDate }: AnalysisCocktailTableProps) {
  const [sortBy, setSortBy] = useState<'name' | 'total' | 'rank' | 'revenue' | 'revenuePercentage' | 'delta'>('total');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const modalContext = useContext(ModalContext);

  const handleSort = (newSortBy: typeof sortBy) => {
    if (sortBy === newSortBy) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortDirection('desc');
    }
  };

  const sortedCocktails = [...cocktails].sort((a, b) => {
    const detailA = details.get(a.id);
    const detailB = details.get(b.id);
    if (!detailA || !detailB) return 0;

    let comparison = 0;
    switch (sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'total':
        comparison = detailA.total - detailB.total;
        break;
      case 'rank':
        comparison = (detailA.rank || 0) - (detailB.rank || 0);
        break;
      case 'revenue':
        comparison = (detailA.revenue || 0) - (detailB.revenue || 0);
        break;
      case 'revenuePercentage':
        const percentageA = totalRevenue > 0 ? ((detailA.revenue || 0) / totalRevenue) * 100 : 0;
        const percentageB = totalRevenue > 0 ? ((detailB.revenue || 0) / totalRevenue) * 100 : 0;
        comparison = percentageA - percentageB;
        break;
      case 'delta':
        comparison = (detailA.delta || 0) - (detailB.delta || 0);
        break;
    }
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const getSortIcon = (column: typeof sortBy) => {
    if (sortBy !== column) return '';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  return (
    <div className="overflow-x-auto">
      <table className="table table-sm">
        <thead>
          <tr>
            <th>Farbe</th>
            <th>
              <button className="btn btn-ghost btn-xs" onClick={() => handleSort('name')}>
                Cocktail {getSortIcon('name')}
              </button>
            </th>
            <th>
              <div className="flex items-center gap-1">
                <button className="btn btn-ghost btn-xs" onClick={() => handleSort('total')}>
                  Bestellungen {getSortIcon('total')}
                </button>
              </div>
            </th>
            <th>
              <button className="btn btn-ghost btn-xs" onClick={() => handleSort('rank')}>
                Rang {getSortIcon('rank')}
              </button>
            </th>
            <th>
              <button className="btn btn-ghost btn-xs" onClick={() => handleSort('revenue')}>
                Umsatz {getSortIcon('revenue')}
              </button>
            </th>
            <th>
              <button className="btn btn-ghost btn-xs" onClick={() => handleSort('revenuePercentage')}>
                Anteil {getSortIcon('revenuePercentage')}
              </button>
            </th>
            <th>
              <button className="btn btn-ghost btn-xs" onClick={() => handleSort('delta')}>
                Delta {getSortIcon('delta')}
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedCocktails.map((cocktail) => {
            const detail = details.get(cocktail.id);
            if (!detail) return null;

            const revenue = detail.revenue || 0;
            const previousRevenue = detail.previousRevenue || 0;
            const revenueDifference = revenue - previousRevenue;
            const revenuePercentage = totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0;
            const previousRevenuePercentage = previousTotalRevenue > 0 ? (previousRevenue / previousTotalRevenue) * 100 : 0;
            const revenuePercentageDifference = revenuePercentage - previousRevenuePercentage;

            const total = detail.total || 0;
            const previousTotal = detail.previousTotal || 0;
            const totalDifference = total - previousTotal;

            return (
              <tr key={cocktail.id}>
                <td>
                  <div className="h-4 w-4 rounded" style={{ backgroundColor: cocktail.name.string2color() }} title={cocktail.name} />
                </td>
                <td className="font-semibold">{cocktail.name}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <span>
                      {total || '-'}
                      {previousTotal !== undefined && previousTotal !== null && (
                        <span className="ml-1 text-xs text-base-content/70">
                          ({totalDifference > 0 ? '+' : ''}
                          {totalDifference.toLocaleString('de-DE')})
                        </span>
                      )}
                    </span>
                    {workspaceId && total > 0 && (
                      <button
                        className="btn btn-ghost btn-xs btn-circle"
                        onClick={() => {
                          modalContext.openModal(
                            <CocktailOrderTimesModal
                              workspaceId={workspaceId}
                              cocktailId={cocktail.id}
                              cocktailName={cocktail.name}
                              startDate={startDate}
                              endDate={endDate}
                            />,
                            true,
                          );
                        }}
                        title="Bestellzeitpunkte anzeigen"
                      >
                        <FaInfoCircle />
                      </button>
                    )}
                  </div>
                </td>
                <td>{detail.rank ? `#${detail.rank}` : '-'}</td>
                <td>
                  {revenue > 0 ? revenue.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) : '-'}
                  {previousRevenue !== undefined && previousRevenue !== null && previousRevenue !== 0 && (
                    <span className="ml-1 text-xs text-base-content/70">
                      ({revenueDifference > 0 ? '+' : ''}
                      {revenueDifference.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })})
                    </span>
                  )}
                </td>
                <td>
                  {revenuePercentage > 0 ? revenuePercentage.toFixed(1) + '%' : '-'}
                  {previousTotalRevenue > 0 && previousRevenue !== undefined && previousRevenue !== null && (
                    <span className="ml-1 text-xs text-base-content/70">
                      ({revenuePercentageDifference > 0 ? '+' : ''}
                      {revenuePercentageDifference.toFixed(1)} PP)
                    </span>
                  )}
                </td>
                <td>{detail.delta !== undefined ? (detail.delta > 0 ? '+' : '') + detail.delta.toFixed(1) + '%' : '-'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
