import { ManageEntityLayout } from '@components/layout/ManageEntityLayout';
import { useRouter } from 'next/router';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { CocktailStatisticItemFull } from '../../../../../models/CocktailStatisticItemFull';
import { alertService } from '@lib/alertService';
import { FaSyncAlt, FaTrashAlt } from 'react-icons/fa';
import { UserContext } from '@lib/context/UserContextProvider';
import { Loading } from '@components/Loading';
import ListSearchField from '../../../../../components/ListSearchField';
import { NextPageWithPullToRefresh } from '../../../../../types/next';
import { TimeRange, TimeRangePicker } from '@components/statistics/TimeRangePicker';
import '../../../../../lib/DateUtils';
import { getStartOfDay, getEndOfDay } from '@lib/dateHelpers';

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

  // Default to today (respecting dayStartTime)
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

  // Load workspace day start time setting
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

  // Update timeRange when dayStartTime is loaded
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
    setCurrentPage(1); // Reset to first page when time range changes
  }, []);

  const handleSearchChange = useCallback((newSearch: string) => {
    setSearchQuery(newSearch);
    setCurrentPage(1); // Reset to first page when search changes
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
          <button className="btn btn-square btn-primary btn-sm md:btn-md" onClick={loadLogs} title="Aktualisieren">
            {loading ? <span className="loading loading-spinner"></span> : <FaSyncAlt />}
          </button>
        </div>
      }
    >
      <div className={'flex flex-col gap-4'}>
        <div className={'card'}>
          <div className={'card-body'}>
            <div className={'card-title flex w-full justify-between'}>Bestell-Logs</div>
            <ListSearchField onFilterChange={handleSearchChange} />

            <div className="overflow-x-auto">
              <table className="table-compact table table-zebra w-full">
                <thead>
                  <tr>
                    <td>Zeitpunkt</td>
                    <td>Cocktail</td>
                    <td>Cocktail Karte</td>
                    <td>Hinzugefügt von</td>
                    <td></td>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5} className={'text-center'}>
                        <Loading />
                      </td>
                    </tr>
                  ) : cocktailStatisticItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className={'text-center'}>
                        Keine Einträge gefunden
                      </td>
                    </tr>
                  ) : (
                    cocktailStatisticItems.map((item) => (
                      <tr key={'statistic-item-' + item.id}>
                        <td>{new Date(item.date).toFormatDateTimeString()}</td>
                        <td>{item.cocktail?.name || 'Gelöschter Cocktail'}</td>
                        <td>{item.cocktailCard?.name || '-'}</td>
                        <td>{item.user?.name || '-'}</td>
                        <td className={'flex items-center justify-end space-x-2'}>
                          <button
                            disabled={!userContext.isUserPermitted('MANAGER')}
                            className={`btn ${itemDeleting[item.id] ? '' : 'btn-square'} btn-error btn-sm`}
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
                            {itemDeleting[item.id] ? <span className="loading loading-spinner"></span> : <></>}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {pagination && (
              <div className={'mt-4 flex items-center justify-center gap-2'}>
                <button className={'btn btn-sm'} disabled={currentPage === 1 || loading} onClick={() => handlePageChange(currentPage - 1)}>
                  Vorherige
                </button>
                <span className={'text-sm'}>
                  Seite {pagination.page} von {pagination.totalPages} ({pagination.total} Einträge)
                </span>
                <button className={'btn btn-sm'} disabled={currentPage >= pagination.totalPages || loading} onClick={() => handlePageChange(currentPage + 1)}>
                  Nächste
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </ManageEntityLayout>
  );
};

export default LogsPage;
