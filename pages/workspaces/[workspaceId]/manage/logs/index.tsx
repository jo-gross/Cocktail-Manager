import { ManageEntityLayout } from '@components/layout/ManageEntityLayout';
import { useRouter } from 'next/router';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CocktailStatisticItemDto } from '@lib/schemas/statistics';
import { alertService } from '@lib/alertService';
import { FaSyncAlt, FaTrashAlt } from 'react-icons/fa';
import { UserContext } from '@lib/context/UserContextProvider';
import ListSearchField from '../../../../../components/ListSearchField';
import { NextPageWithPullToRefresh } from '../../../../../types/next';
import { TimeRange, TimeRangePicker } from '@components/statistics/TimeRangePicker';
import { formatDateTime } from '@lib/DateUtils';
import { getStartOfDay, getEndOfDay } from '@lib/dateHelpers';
import { fetchWorkspaceSettingsSafe } from '@lib/network/workspaces';
import { deleteStatisticLog, fetchStatisticLogsSafe } from '@lib/network/statistics';
import { alertApiV1Error } from '@lib/network/apiV1';
import type { PaginationMeta } from '@lib/http/responses';
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

const LogsPage: NextPageWithPullToRefresh = () => {
  const router = useRouter();
  const { t } = useTranslation(['manage', 'common', 'nav', 'entity', 'errors']);
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
    fetchWorkspaceSettingsSafe(workspaceId, (settings) => {
      if (settings.statisticDayStartTime) {
        setDayStartTime(settings.statisticDayStartTime);
      }
    });
  }, [workspaceId]);

  useEffect(() => {
    if (dayStartTime !== undefined) {
      const newRange = getInitialTimeRange(dayStartTime);
      setTimeRange(newRange);
    }
  }, [dayStartTime, getInitialTimeRange]);

  const [cocktailStatisticItems, setCocktailStatisticItems] = useState<CocktailStatisticItemDto[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
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

  const getLogSortValue = useCallback((item: CocktailStatisticItemDto, key: string) => {
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

  const loadLogs = useCallback(() => {
    if (!workspaceId) return;
    const params = new URLSearchParams();
    params.append('page', currentPage.toString());
    params.append('limit', '50');
    params.append('startDate', timeRange.startDate.toISOString());
    params.append('endDate', timeRange.endDate.toISOString());
    if (searchQuery.trim()) {
      params.append('search', searchQuery.trim());
    }

    fetchStatisticLogsSafe(workspaceId, params, setCocktailStatisticItems, setPagination, setLoading);
  }, [workspaceId, currentPage, timeRange.startDate.getTime(), timeRange.endDate.getTime(), searchQuery]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  LogsPage.pullToRefresh = () => {
    loadLogs();
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
      title={t('nav:logs')}
      backLink={`/workspaces/${workspaceId}/manage`}
      actions={
        <div className="flex items-center gap-2">
          <TimeRangePicker value={timeRange} onChange={handleTimeRangeChange} compact dayStartTime={dayStartTime} />
          <Tooltip tip={t('common:update')}>
            <Button type="button" variant="primary" shape="square" size="sm" className="md:h-10 md:min-h-10 md:w-10" onClick={loadLogs}>
              {loading ? <UiLoading size="sm" /> : <FaSyncAlt />}
            </Button>
          </Tooltip>
        </div>
      }
      fullHeight
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <Card className="flex min-h-0 flex-1 flex-col">
          <CardBody className="min-h-0 flex-1">
            <CardTitle className="flex w-full justify-between">{t('manage:orderLogs')}</CardTitle>
            <DataTable fillHeight toolbar={<ListSearchField onFilterChange={handleSearchChange} />}>
              <Table zebra compact className="w-full">
                <TableHead>
                  <TableRow>
                    <SortableHeaderCell sortKey="date" activeSortKey={sortKey} direction={sortDirection} onSort={handleSort}>
                      {t('manage:timestamp')}
                    </SortableHeaderCell>
                    <SortableHeaderCell sortKey="cocktail" activeSortKey={sortKey} direction={sortDirection} onSort={handleSort}>
                      {t('common:cocktail_one')}
                    </SortableHeaderCell>
                    <SortableHeaderCell sortKey="card" activeSortKey={sortKey} direction={sortDirection} onSort={handleSort}>
                      {t('manage:cocktailCard')}
                    </SortableHeaderCell>
                    <SortableHeaderCell sortKey="user" activeSortKey={sortKey} direction={sortDirection} onSort={handleSort}>
                      {t('manage:addedBy')}
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
                        {t('manage:noEntriesFound')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedLogItems.map((item) => (
                      <TableRow key={'statistic-item-' + item.id}>
                        <TableCell>{formatDateTime(new Date(item.date))}</TableCell>
                        <TableCell>{item.cocktail?.name || t('entity:deletedCocktail')}</TableCell>
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
                              if (!workspaceId) return;
                              setItemDeleting({ ...itemDeleting, [item.id]: true });
                              try {
                                await deleteStatisticLog(workspaceId, item.id);
                                alertService.success(t('entity:logDeleted'));
                                loadLogs();
                              } catch (error) {
                                console.error('LogsPage -> deleteLogItem', error);
                                alertApiV1Error(error, t('errors:deleteLog'));
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
                  {t('manage:previous')}
                </Button>
                <span className={'text-sm'}>
                  {t('manage:pageOfEntries', {
                    page: pagination.page,
                    totalPages: pagination.totalPages,
                    total: pagination.total,
                  })}
                </span>
                <Button type="button" size="sm" disabled={currentPage >= pagination.totalPages || loading} onClick={() => handlePageChange(currentPage + 1)}>
                  {t('common:next')}
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
