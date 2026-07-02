import { ManageEntityLayout } from '@components/layout/ManageEntityLayout';
import { useRouter } from 'next/router';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { CocktailStatisticItemFull } from '../../../../../models/CocktailStatisticItemFull';
import { alertService } from '@lib/alertService';
import { FaSyncAlt, FaTrashAlt } from 'react-icons/fa';
import { UserContext } from '@lib/context/UserContextProvider';
import ListSearchField from '../../../../../components/ListSearchField';
import { NextPageWithPullToRefresh } from '../../../../../types/next';
import { TimeRange, TimeRangePicker } from '@components/statistics/TimeRangePicker';
import { formatDateTime } from '@lib/DateUtils';
import { getStartOfDay, getEndOfDay } from '@lib/dateHelpers';
import {
  Button,
  Card,
  CardBody,
  CardTitle,
  DataTable,
  Loading as UiLoading,
  SkeletonTableRows,
  SortableHeaderCell,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  toggleSort,
  Tooltip,
  useSortableData,
} from '@components/ui';
import type { SortDirection } from '@components/ui';

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const LogsPage: NextPageWithPullToRefresh = () => {
  const router = useRouter();
  const { workspaceId } = router.query;
  const userContext = useContext(UserContext);

  const getInitialTimeRange = useCallback((dayStartTimeParam?: string): TimeRange => {
    const now = new Date();
    const todayStart = getStartOfDay(now, dayStartTimeParam);
    const todayEnd = getEndOfDay(now, dayStartTimeParam);
    return {
      startDate: todayStart,
      endDate: todayEnd,
      preset: 'today',
    };
  }, []);

  const [timeRange, setTimeRange] = useState<TimeRange>(getInitialTimeRange());
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [dayStartTime, setDayStartTime] = useState<string | undefined>(undefined);
  const [sortKey, setSortKey] = useState('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    if (!workspaceId) return;
    fetch(`/api/workspaces/${workspaceId}/settings`)
      .then((res) => res.json())
      .then((data) => {
        if (data.data?.statisticDayStartTime) {
          setDayStartTime(data.data.statisticDayStartTime);
        }
      })
      .catch(console.error);
  }, [workspaceId]);

  useEffect(() => {
    if (dayStartTime !== undefined) {
      const newRange = getInitialTimeRange(dayStartTime);
      setTimeRange(newRange);
    }
  }, [dayStartTime, getInitialTimeRange]);

  const [cocktailStatisticItems, setCocktailStatisticItems] = useState<CocktailStatisticItemFull[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [itemDeleting, setItemDeleting] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');

  const handleSort = useCallback(
    (key: string) => {
      const next = toggleSort(sortKey, sortDirection, key);
      setSortKey(next.key);
      setSortDirection(next.direction);
    },
    [sortKey, sortDirection],
  );

  const getLogSortValue = useCallback((item: CocktailStatisticItemFull, key: string) => {
    switch (key) {
      case 'date':
        return new Date(item.date);
      case 'cocktail':
        return item.cocktail?.name ?? '';
      case 'card':
        return item.cocktailCard?.name ?? '';
      case 'user':
        return item.user?.name ?? '';
      default:
        return null;
    }
  }, []);

  const sortedLogItems = useSortableData(cocktailStatisticItems, { key: sortKey, direction: sortDirection }, getLogSortValue);

  const loadLogs = useCallback(async () => {
    if (!workspaceId) return;
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('page', currentPage.toString());
      params.append('limit', '50');
      params.append('startDate', timeRange.startDate.toISOString());
      params.append('endDate', timeRange.endDate.toISOString());
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }

      const response = await fetch(`/api/workspaces/${workspaceId}/statistics/logs?${params.toString()}`);
      if (response.ok) {
        const body = await response.json();
        setCocktailStatisticItems(body.data);
        setPagination(body.pagination);
      } else {
        const body = await response.json();
        console.error('LogsPage -> loadLogs', response);
        alertService.error(body.message ?? 'Fehler beim Laden der Logs', response.status, response.statusText);
      }
    } catch (error) {
      console.error('LogsPage -> loadLogs', error);
      alertService.error('Es ist ein Fehler aufgetreten');
    } finally {
      setLoading(false);
    }
  }, [workspaceId, currentPage, timeRange.startDate.getTime(), timeRange.endDate.getTime(), searchQuery]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  LogsPage.pullToRefresh = async () => {
    await loadLogs();
  };

  const handleTimeRangeChange = useCallback((newRange: TimeRange) => {
    setTimeRange(newRange);
    setCurrentPage(1);
  }, []);

  const handleSearchChange = useCallback((newSearch: string) => {
    setSearchQuery(newSearch);
    setCurrentPage(1);
  }, []);

  const handlePageChange = async (newPage: number) => {
    setCurrentPage(newPage);
  };

  return (
    <ManageEntityLayout
      title={'Logs'}
      backLink={`/workspaces/${workspaceId}/manage`}
      actions={
        <div className="flex items-center gap-2">
          <TimeRangePicker value={timeRange} onChange={handleTimeRangeChange} compact dayStartTime={dayStartTime} />
          <Tooltip tip="Aktualisieren">
            <Button type="button" variant="primary" shape="square" size="sm" className="md:h-10 md:min-h-10 md:w-10" onClick={loadLogs}>
              {loading ? <UiLoading size="sm" /> : <FaSyncAlt />}
            </Button>
          </Tooltip>
        </div>
      }
    >
      <div className={'flex flex-col gap-4'}>
        <Card>
          <CardBody>
            <CardTitle className="flex w-full justify-between">Bestell-Logs</CardTitle>
            <DataTable toolbar={<ListSearchField onFilterChange={handleSearchChange} />}>
              <Table zebra compact className="w-full">
                <TableHead>
                  <TableRow>
                    <SortableHeaderCell sortKey="date" activeSortKey={sortKey} direction={sortDirection} onSort={handleSort}>
                      Zeitpunkt
                    </SortableHeaderCell>
                    <SortableHeaderCell sortKey="cocktail" activeSortKey={sortKey} direction={sortDirection} onSort={handleSort}>
                      Cocktail
                    </SortableHeaderCell>
                    <SortableHeaderCell sortKey="card" activeSortKey={sortKey} direction={sortDirection} onSort={handleSort}>
                      Cocktail Karte
                    </SortableHeaderCell>
                    <SortableHeaderCell sortKey="user" activeSortKey={sortKey} direction={sortDirection} onSort={handleSort}>
                      Hinzugefügt von
                    </SortableHeaderCell>
                    <TableHeaderCell></TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <SkeletonTableRows columns={5} avatarColumn={-1} rows={8} />
                  ) : sortedLogItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className={'text-center'}>
                        Keine Einträge gefunden
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedLogItems.map((item) => (
                      <TableRow key={'statistic-item-' + item.id}>
                        <TableCell>{formatDateTime(new Date(item.date))}</TableCell>
                        <TableCell>{item.cocktail?.name || 'Gelöschter Cocktail'}</TableCell>
                        <TableCell>{item.cocktailCard?.name || '-'}</TableCell>
                        <TableCell>{item.user?.name || '-'}</TableCell>
                        <TableCell className={'flex items-center justify-end space-x-2'}>
                          <Button
                            type="button"
                            disabled={!userContext.isUserPermitted('MANAGER')}
                            variant="error"
                            size="sm"
                            shape={itemDeleting[item.id] ? 'default' : 'square'}
                            onClick={async () => {
                              setItemDeleting({ ...itemDeleting, [item.id]: true });
                              try {
                                const response = await fetch(`/api/workspaces/${workspaceId}/statistics/logs/${item.id}`, {
                                  method: 'DELETE',
                                });
                                if (response.ok) {
                                  alertService.success('Log-Eintrag gelöscht');
                                  await loadLogs();
                                } else {
                                  const body = await response.json();
                                  console.error('LogsPage -> deleteLogItem', response);
                                  alertService.error(body.message ?? 'Fehler beim Löschen des Log-Eintrags', response.status, response.statusText);
                                }
                              } catch (error) {
                                console.error('LogsPage -> deleteLogItem', error);
                                alertService.error('Es ist ein Fehler aufgetreten');
                              } finally {
                                setItemDeleting({ ...itemDeleting, [item.id]: false });
                              }
                            }}
                          >
                            <FaTrashAlt />
                            {itemDeleting[item.id] ? <UiLoading size="sm" /> : null}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </DataTable>

            {pagination && (
              <div className={'mt-4 flex items-center justify-center gap-2'}>
                <Button type="button" size="sm" disabled={currentPage === 1 || loading} onClick={() => handlePageChange(currentPage - 1)}>
                  Vorherige
                </Button>
                <span className={'text-sm'}>
                  Seite {pagination.page} von {pagination.totalPages} ({pagination.total} Einträge)
                </span>
                <Button type="button" size="sm" disabled={currentPage >= pagination.totalPages || loading} onClick={() => handlePageChange(currentPage + 1)}>
                  Nächste
                </Button>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </ManageEntityLayout>
  );
};

export default LogsPage;
