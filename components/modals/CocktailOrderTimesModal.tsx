import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatTime } from '@lib/DateUtils';
import { toIntlLocale } from '@lib/i18n/format';
import { Button, ButtonGroup, Input, Loading, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow, Tooltip } from '@components/ui';
import { alertApiV1Error, apiV1FetchPaginated } from '@lib/network/apiV1';

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
  const { t, i18n } = useTranslation(['cocktail', 'common', 'errors']);
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

      const result = await apiV1FetchPaginated<OrderTime[]>(
        `/api/v1/workspaces/${workspaceId}/statistics/advanced/cocktails/${cocktailId}/orders?${params.toString()}`,
      );
      setOrders(result.data);
      setTotalPages(result.pagination.totalPages);
    } catch (error) {
      alertApiV1Error(error, t('errors:loadOrders'));
    } finally {
      setLoading(false);
    }
  }, [workspaceId, cocktailId, page, startDate, endDate, search, t]);

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
    return date.toLocaleString(toIntlLocale(i18n.language), {
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
      <h3 className="flex-shrink-0 text-xl font-bold">{t('cocktail:orderTimesTitle', { name: cocktailName })}</h3>

      <ButtonGroup className="w-full">
        <Input
          joinItem
          className="flex-1"
          type="text"
          placeholder={t('cocktail:orderSearchPlaceholder')}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        {searchInput && (
          <Tooltip tip={t('common:searchReset')}>
            <Button joinItem variant="outline" onClick={handleClearSearch}>
              {'\u00d7'}
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
          {search ? t('cocktail:noOrdersFound') : t('cocktail:noOrders')}
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
            <Table zebra compact>
              <TableHead className="sticky top-0 z-10 bg-base-200">
                <TableRow>
                  <TableHeaderCell>{t('common:date')}</TableHeaderCell>
                  <TableHeaderCell>{t('common:time')}</TableHeaderCell>
                  <TableHeaderCell>{t('common:user')}</TableHeaderCell>
                  <TableHeaderCell>{t('common:card')}</TableHeaderCell>
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
                {t('common:back')}
              </Button>
              <span className="text-sm">{t('common:pageOf', { page, total: totalPages })}</span>
              <Button size="sm" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}>
                {t('common:next')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
