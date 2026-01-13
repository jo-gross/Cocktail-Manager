import React, { useCallback, useEffect, useState, useRef } from 'react';
import { FaInfoCircle } from 'react-icons/fa';
import { Loading } from '../Loading';
import { alertService } from '@lib/alertService';
import '@lib/DateUtils';

interface OrderTime {
  id: string;
  date: string;
  user: { name: string; email: string } | null;
  cocktailCard: { name: string } | null;
  notes: string | null;
}

interface CocktailOrderTimesModalProps {
  workspaceId: string;
  cocktailId: string;
  cocktailName: string;
  startDate?: Date;
  endDate?: Date;
}

export default function CocktailOrderTimesModal({ workspaceId, cocktailId, cocktailName, startDate, endDate }: CocktailOrderTimesModalProps) {
  const [orders, setOrders] = useState<OrderTime[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const pageSize = 50;

  const fetchOrders = useCallback(async () => {
    if (!workspaceId || !cocktailId) return;

    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
      });

      if (startDate) {
        params.append('startDate', startDate.toISOString());
      }
      if (endDate) {
        params.append('endDate', endDate.toISOString());
      }
      if (search.trim()) {
        params.append('search', search.trim());
      }

      const response = await fetch(`/api/workspaces/${workspaceId}/statistics/advanced/cocktails/${cocktailId}/orders?${params.toString()}`);
      if (response.ok) {
        const body = await response.json();
        setOrders(body.data);
        setTotalPages(body.pagination.totalPages);
      } else {
        let body;
        try {
          body = await response.json();
        } catch (jsonError) {
          const text = await response.text();
          console.error('CocktailOrderTimesModal -> fetchOrders - Non-JSON response', text);
          alertService.error('Fehler beim Laden der Bestellungen', response.status, response.statusText);
          return;
        }
        console.error('CocktailOrderTimesModal -> fetchOrders', response);
        alertService.error(body.message ?? 'Fehler beim Laden der Bestellungen', response.status, response.statusText);
      }
    } catch (error) {
      console.error('CocktailOrderTimesModal -> fetchOrders', error);
      alertService.error('Es ist ein Fehler aufgetreten');
    } finally {
      setLoading(false);
    }
  }, [workspaceId, cocktailId, page, startDate, endDate, search]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Debounced search effect - updates search state after user stops typing
  useEffect(() => {
    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer
    debounceTimerRef.current = setTimeout(() => {
      setSearch(searchInput);
      setPage(1); // Reset to first page when searching
    }, 300); // 300ms debounce delay

    // Cleanup on unmount
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchInput]);

  // Format date with weekday (e.g., "Do. 08.01.25")
  const formatDateWithWeekday = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearch('');
    setPage(1);
  };

  return (
    <div className="flex max-h-[80vh] flex-col gap-4 p-4">
      <h3 className="flex-shrink-0 text-xl font-bold">Bestellzeitpunkte: {cocktailName}</h3>

      {/* Search */}
      <div className={"join w-full"}>
        <input
          className="input join-item input-bordered flex-1"
          type="text"
          placeholder="Suchen nach Datum, Benutzer, Karte oder Notiz..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        {searchInput && (
          <button className="btn join-item btn-outline" onClick={handleClearSearch} title="Suche zurücksetzen">
            ✕
          </button>
        )}
        {loading && (
          <span className="btn join-item btn-square btn-ghost">
            <span className="loading loading-spinner loading-sm"></span>
          </span>
        )}
      </div>

      {/* Orders List - Scrollable */}
      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loading />
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-8 text-center text-base-content/70">
          {search ? 'Keine Bestellungen gefunden' : 'Keine Bestellungen vorhanden'}
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-auto">
            <table className="table table-zebra table-sm">
              <thead className="sticky top-0 bg-base-200 z-10">
                <tr>
                  <th>Datum</th>
                  <th>Uhrzeit</th>
                  <th>Benutzer</th>
                  <th>Karte</th>
                  <th>Notiz</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td className="font-medium">{formatDateWithWeekday(order.date)}</td>
                    <td>{new Date(order.date).toFormatTimeString()}</td>
                    <td>{order.user ? order.user.name : '-'}</td>
                    <td>{order.cocktailCard ? order.cocktailCard.name : '-'}</td>
                    <td>{order.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination - Always visible */}
          {totalPages > 1 && (
            <div className="flex flex-shrink-0 items-center justify-center gap-2 border-t border-base-300 pt-2">
              <button className="btn btn-sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>
                Zurück
              </button>
              <span className="text-sm">
                Seite {page} von {totalPages}
              </span>
              <button className="btn btn-sm" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}>
                Weiter
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

