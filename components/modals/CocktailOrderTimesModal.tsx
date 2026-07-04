import React, { useCallback, useEffect, useRef, useState } from 'react';
import { alertService } from '@lib/alertService';
import { formatTime } from '@lib/DateUtils';
import { Button, ButtonGroup, Input, Loading, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow, Tooltip } from '@components/ui';

interface OrderTime {
  id: string;
  date: string;
  user: { name: string; email: string } | null;
  cocktailCard: { name: string } | null;
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
        } catch {
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

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchInput]);

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

      <ButtonGroup className="w-full">
        <Input
          joinItem
          className="flex-1"
          type="text"
          placeholder="Suchen nach Datum, Benutzer oder Karte..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        {searchInput && (
          <Tooltip tip="Suche zurücksetzen">
            <Button joinItem variant="outline" onClick={handleClearSearch}>
              ✕
            </Button>
          </Tooltip>
        )}
        {loading && (
          <Button joinItem variant="ghost" shape="square" type="button" tabIndex={-1}>
            <Loading size="sm" />
          </Button>
        )}
      </ButtonGroup>

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
          <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
            <Table zebra compact>
              <TableHead className="sticky top-0 z-10 bg-base-200">
                <TableRow>
                  <TableHeaderCell>Datum</TableHeaderCell>
                  <TableHeaderCell>Uhrzeit</TableHeaderCell>
                  <TableHeaderCell>Benutzer</TableHeaderCell>
                  <TableHeaderCell>Karte</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{formatDateWithWeekday(order.date)}</TableCell>
                    <TableCell>{formatTime(new Date(order.date))}</TableCell>
                    <TableCell>{order.user ? order.user.name : '-'}</TableCell>
                    <TableCell>{order.cocktailCard ? order.cocktailCard.name : '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex flex-shrink-0 items-center justify-center gap-2 border-t border-base-300 pt-2">
              <Button size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>
                Zurück
              </Button>
              <span className="text-sm">
                Seite {page} von {totalPages}
              </span>
              <Button size="sm" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}>
                Weiter
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
