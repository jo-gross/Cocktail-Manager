import { ManageEntityLayout } from '@components/layout/ManageEntityLayout';
import { useRouter } from 'next/router';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { CocktailStatisticItemFull } from '../../../../../models/CocktailStatisticItemFull';
import { alertService } from '@lib/alertService';
import { FaSyncAlt, FaTrashAlt } from 'react-icons/fa';
import _ from 'lodash';
import { UserContext } from '@lib/context/UserContextProvider';
import { ArcElement, CategoryScale, Legend, LinearScale, TimeScale, Tooltip } from 'chart.js';
import { Chart as ChartJS } from 'chart.js/auto';
import { Bar, Doughnut } from 'react-chartjs-2';
import '../../../../../lib/DateUtils';
import '../../../../../lib/StringUtils';
import { Loading } from '@components/Loading';
import ListSearchField from '../../../../../components/ListSearchField';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { NextPageWithPullToRefresh } from '../../../../../types/next';

ChartJS.register(ArcElement, Tooltip, Legend, TimeScale, CategoryScale, LinearScale);

const StatisticsPage: NextPageWithPullToRefresh = () => {
  const router = useRouter();
  const { workspaceId } = router.query;
  const userContext = useContext(UserContext);

  const [startDate, setStartDate] = useState<Date>(typeof router.query.startDate === 'string' ? new Date(router.query.startDate) : new Date());
  const [endDate, setEndDate] = useState<Date>(typeof router.query.endDate === 'string' ? new Date(router.query.endDate) : new Date());

  const [showAllDays, setShowAllDays] = useState(false);
  const [groupBy, setGroupBy] = useState<'hour' | 'day'>('hour');

  const [cocktailStatisticItems, setCocktailStatisticItems] = useState<CocktailStatisticItemFull[]>([]);
  const [loading, setLoading] = useState(false);

  const [itemDeleting, setItemDeleting] = useState<Record<string, boolean>>({});

  const [filterString, setFilterString] = useState('');

  const refreshStatistics = useCallback(async () => {
    if (!workspaceId) return;
    try {
      setLoading(true);
      const response = await fetch(`/api/workspaces/${workspaceId}/statistics/cocktails?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`);
      if (response.ok) {
        const body = await response.json();
        setCocktailStatisticItems(body.data);
      } else {
        const body = await response.json();
        console.error('StatisticsPage -> refreshStatistics', response);
        alertService.error(body.message ?? 'Fehler beim aktualisieren der Statistik', response.status, response.statusText);
      }
    } catch (error) {
      console.error('StatisticsPage -> refreshStatistics', error);
      alertService.error('Es ist ein Fehler aufgetreten');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, workspaceId]);

  useEffect(() => {
    refreshStatistics().then();
    if (endDate.getTime() - startDate.getTime() < 24 * 3600 * 1000) {
      setGroupBy('hour');
    }
  }, [startDate, endDate, refreshStatistics]);

  StatisticsPage.pullToRefresh = async () => {
    await refreshStatistics();
  };

  interface ProcessedData {
    labels: string[];
    datasets: {
      label: string;
      data: number[];
      backgroundColor: string;
    }[];
  }

  function processDataGroupByHourly(data: CocktailStatisticItemFull[]): ProcessedData {
    const hourlyCocktails: Record<string, Record<string, number>> = {};

    data
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .forEach((entry) => {
        const date = new Date(entry.date);
        // Runden der Stunden für den Zeitslot
        const hour = date.getHours();
        const dateString = date.toFormatDateString();
        const formattedHour = `${dateString} ${hour}:00 - ${hour + 1}:00`;
        const cocktailName = entry.cocktail.name;

        if (!hourlyCocktails[formattedHour]) {
          hourlyCocktails[formattedHour] = {};
        }
        if (!hourlyCocktails[formattedHour][cocktailName]) {
          hourlyCocktails[formattedHour][cocktailName] = 0;
        }

        hourlyCocktails[formattedHour][cocktailName]++;
      });

    const labels = Object.keys(hourlyCocktails);
    const cocktailNames = new Set<string>();

    Object.values(hourlyCocktails).forEach((cocktails) => {
      Object.keys(cocktails).forEach((name) => cocktailNames.add(name));
    });

    const datasets = Array.from(cocktailNames).map((cocktailName) => ({
      label: cocktailName,
      data: labels.map((hour) => hourlyCocktails[hour][cocktailName] || 0),
      backgroundColor: cocktailName.string2color(), // Zufällige Farbe
    }));

    return { labels, datasets };
  }

  function processDataGroupByDaily(data: CocktailStatisticItemFull[], showEmptyDays: boolean): ProcessedData {
    const dailyCocktails: Record<string, Record<string, number>> = {};

    data
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .forEach((entry) => {
        const date = new Date(entry.date);
        // Gruppieren in Tage von 8 AM bis 8 AM
        const adjustedDate = new Date(date);
        if (date.getHours() < 8) {
          adjustedDate.setDate(date.getDate() - 1);
        }

        const nextDate = new Date(adjustedDate);
        nextDate.setDate(adjustedDate.getDate() + 1);

        const dateString = `${adjustedDate.toFormatDateString()}/${nextDate.toFormatDateString()}`;
        const cocktailName = entry.cocktail.name;

        if (!dailyCocktails[dateString]) {
          dailyCocktails[dateString] = {};
        }
        if (!dailyCocktails[dateString][cocktailName]) {
          dailyCocktails[dateString][cocktailName] = 0;
        }

        dailyCocktails[dateString][cocktailName]++;
      });

    let labels = Object.keys(dailyCocktails);
    const cocktailNames = new Set<string>();

    if (showEmptyDays) {
      labels = [];

      const loopStartDate = new Date(startDate);
      const loopEndDate = new Date(endDate);
      const allDates: string[] = [];

      while (loopStartDate <= loopEndDate) {
        const nextDate = new Date(loopStartDate);
        nextDate.setDate(loopStartDate.getDate() + 1);
        const dateString = `${loopStartDate.toFormatDateString()}/${nextDate.toFormatDateString()}`;
        allDates.push(dateString);
        loopStartDate.setDate(loopStartDate.getDate() + 1);
      }

      allDates.forEach((dateString) => {
        labels.push(dateString);
        if (!dailyCocktails[dateString]) {
          dailyCocktails[dateString] = {};
        }
      });
    }

    Object.values(dailyCocktails).forEach((cocktails) => {
      Object.keys(cocktails).forEach((name) => cocktailNames.add(name));
    });

    const datasets = Array.from(cocktailNames).map((cocktailName) => ({
      label: cocktailName,
      data: labels.map((day) => dailyCocktails[day][cocktailName] || 0),
      backgroundColor: cocktailName.string2color(), // Zufällige Farbe
    }));

    console.log({ labels, datasets });
    return { labels, datasets };
  }

  return (
    <ManageEntityLayout
      title={'Statistiken'}
      backLink={`/workspaces/${workspaceId}/manage`}
      actions={[
        <div key={'startDate'} className={'form-control hidden md:flex'}>
          <label className={'lable'}>Startdatum</label>
          <input
            className={'input input-bordered'}
            type={'date'}
            value={new Date(startDate).toISOString().split('T')[0]}
            onChange={async (event) => {
              if (!event.target.value) return;
              const start = new Date(event.target.value);
              let end = endDate;

              if (start.getTime() > end.getTime()) {
                end = start;
                setEndDate(start);
              }
              setStartDate(start);

              await router.replace({
                pathname: router.pathname,
                query: {
                  ...router.query,
                  startDate: start.toISOString().split('T')[0],
                  endDate: end.toISOString().split('T')[0],
                },
              });
            }}
          />
        </div>,
        <div key={'endDate'} className={'form-control hidden md:flex'}>
          <label className={'lable'}>
            <span className={'lable-text'}>Enddatum</span>
          </label>
          <input
            className={`input input-bordered`}
            type={'date'}
            value={endDate.toISOString().split('T')[0]}
            onChange={async (event) => {
              if (!event.target.value) return;
              const end = new Date(event.target.value);
              let start = startDate;
              if (end.getTime() < startDate.getTime()) {
                start = end;
                setStartDate(end);
              }
              setEndDate(end);

              await router.replace({
                pathname: router.pathname,
                query: {
                  ...router.query,
                  startDate: start.toISOString().split('T')[0],
                  endDate: end.toISOString().split('T')[0],
                },
              });
            }}
          />
        </div>,
      ]}
    >
      <div className={'grid grid-cols-1 gap-2 xl:grid-cols-2'}>
        <div key={'startDate-mobile'} className={'form-control md:hidden'}>
          <label className={'lable'}>Startdatum</label>
          <input
            className={'input input-bordered'}
            type={'date'}
            value={startDate.toISOString().split('T')[0]}
            onChange={async (event) => {
              const start = new Date(event.target.value);
              let end = endDate;
              if (start.getTime() > end.getTime()) {
                end = start;
                setEndDate(start);
              }
              setStartDate(start);

              await router.replace({
                pathname: router.pathname,
                query: {
                  ...router.query,
                  startDate: start.toISOString().split('T')[0],
                  endDate: end.toISOString().split('T')[0],
                },
              });
            }}
          />
        </div>
        <div key={'endDate-mobile'} className={'form-control md:hidden'}>
          <label className={'lable'}>
            <span className={'lable-text'}>Enddatum</span>
          </label>
          <input
            className={`input input-bordered`}
            type={'date'}
            value={endDate.toISOString().split('T')[0]}
            onChange={async (event) => {
              const end = new Date(event.target.value);
              let start = startDate;
              if (end.getTime() < startDate.getTime()) {
                start = end;
                setStartDate(end);
              }
              setEndDate(end);

              await router.replace({
                pathname: router.pathname,
                query: {
                  ...router.query,
                  startDate: start.toISOString().split('T')[0],
                  endDate: end.toISOString().split('T')[0],
                },
              });
            }}
          />
        </div>
        <div className={'card'}>
          <div className={'card-body'}>
            <div className={'card-title'}>
              Übersicht ({startDate.toFormatDateString()} - {endDate.toFormatDateString()})
            </div>
            <div className={'gird-cols-1 grid gap-2 md:grid-cols-2'}>
              <div>
                <div>
                  {_.chain(cocktailStatisticItems)
                    .groupBy('cocktailId')
                    .map((cocktailStatisticItems) => ({ name: cocktailStatisticItems[0].cocktail.name, count: cocktailStatisticItems.length }))
                    .orderBy('count', 'desc')
                    .map((cocktailStatisticItem) => (
                      <div key={`cocktail-items-${cocktailStatisticItem.name}`}>
                        <span className={'font-bold'}>{cocktailStatisticItem.name}: </span>
                        <span>{cocktailStatisticItem.count.toLocaleString()}</span>
                      </div>
                    ))
                    .value()}
                </div>
                <div className={'divider-sm'}></div>
                <div>
                  <strong>Cocktails in Summe: </strong>
                  {cocktailStatisticItems.length.toLocaleString()}
                </div>
              </div>
              <div className="h-[50vh] w-full rounded-lg border bg-base-100 p-4 lg:h-[70vh]">
                <Doughnut
                  data={{
                    labels: _.chain(cocktailStatisticItems)
                      .groupBy('cocktailId')
                      .map((cocktailStatisticItems) => ({ name: cocktailStatisticItems[0].cocktail.name, count: cocktailStatisticItems.length }))
                      .orderBy('count', 'desc')
                      .map((cocktailStatisticItem) => cocktailStatisticItem.name)
                      .value(),
                    datasets: [
                      {
                        label: 'Anzahl',
                        data: _.chain(cocktailStatisticItems)
                          .groupBy('cocktailId')
                          .map((cocktailStatisticItems) => ({
                            name: cocktailStatisticItems[0].cocktail.name,
                            count: cocktailStatisticItems.length,
                          }))
                          .orderBy('count', 'desc')
                          .map((cocktailStatisticItem) => cocktailStatisticItem.count)
                          .value(),
                        backgroundColor: _.chain(cocktailStatisticItems)
                          .groupBy('cocktailId')
                          .map((cocktailStatisticItems) => ({
                            name: cocktailStatisticItems[0].cocktail.name,
                            count: cocktailStatisticItems.length,
                          }))
                          .orderBy('count', 'desc')
                          .map((cocktailStatisticItem) => cocktailStatisticItem.name.string2color())
                          .value(),
                        hoverOffset: 4,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'bottom',
                        labels: {
                          usePointStyle: true,
                        },
                      },
                    },
                  }}
                />
              </div>
            </div>
          </div>
        </div>
        <div className={'card'}>
          <div className={'card-body'}>
            <div className={'card-title'}>
              Übersicht ({startDate.toFormatDateString()} - {endDate.toFormatDateString()})
            </div>
            <div className={'font-thin'}>Ein Tag geht immer von 8:00 Uhr bis 8:00 Uhr des folgenden Tages</div>
            <div className={'flex w-full flex-row items-start justify-start gap-2'}>
              <div className={'form-control'}>
                <label className={'label flex w-fit flex-col items-start justify-start'}>
                  <div className={'label-text'}>Gruppieren nach</div>
                </label>
                <select className={'select select-bordered'} value={groupBy} onChange={(event) => setGroupBy(event.target.value as 'day' | 'hour')}>
                  <option value={'hour'}>Stunden</option>
                  <option value={'day'} disabled={endDate.getTime() - startDate.getTime() < 24 * 3600 * 1000}>
                    Tagen
                  </option>
                </select>
              </div>
              <div className={'form-control h-full'}>
                <label className={'flex h-full w-fit flex-col items-start gap-1'}>
                  <div className={'label'}>
                    <div className={'label-text'}>Alle Tage anzeigen</div>
                  </div>
                  <div className={'flex h-full items-center'}>
                    <input
                      disabled={groupBy != 'day'}
                      className={'toggle toggle-primary'}
                      type={'checkbox'}
                      checked={showAllDays}
                      onClick={() => setShowAllDays(!showAllDays)}
                    />
                  </div>
                </label>
              </div>
            </div>
            <div className="h-[50vh] w-full overflow-x-auto rounded-lg border bg-base-100 p-4 lg:h-[70vh]">
              <Bar
                plugins={[ChartDataLabels]}
                data={
                  endDate.getTime() - startDate.getTime() >= 24 * 3600 * 1000 && groupBy == 'day'
                    ? processDataGroupByDaily(cocktailStatisticItems, showAllDays)
                    : processDataGroupByHourly(cocktailStatisticItems)
                }
                options={{
                  maintainAspectRatio: false,
                  responsive: true,
                  layout: {
                    padding: {
                      top: 20, // Platz für obere Labels
                      right: 20,
                      bottom: 20,
                      left: 20,
                    },
                  },
                  scales: {
                    x: {
                      stacked: true,
                    },
                    y: {
                      beginAtZero: true,
                      stacked: true,
                    },
                  },
                  plugins: {
                    legend: {
                      position: 'bottom',
                      labels: {
                        usePointStyle: true,
                      },
                    },
                    datalabels: {
                      display: 'auto',
                      font: {
                        weight: 'bold',
                      },
                      anchor: 'end',
                      offset: 4,
                      align: 'end',
                      formatter: (value, context) => {
                        const dataIndex = context.dataIndex;

                        // Berechnung der Gesamtsumme nur für sichtbare Datensätze
                        const total = context.chart.data.datasets.reduce((sum, dataset, index) => {
                          if (!context.chart.isDatasetVisible(index)) {
                            return sum; // Überspringe unsichtbare Datensätze
                          }
                          return sum + (dataset.data[dataIndex] as number);
                        }, 0);

                        const isTopOfStack = context.datasetIndex === context.chart.data.datasets.length - 1;

                        return isTopOfStack ? total : null;
                      },
                    },
                  },
                }}
              />
            </div>
          </div>
        </div>
        <div className={'card col-span-full'}>
          <div className={'card-body'}>
            <div className={'card-title flex w-full justify-between'}>
              Logs
              <button className={'btn btn-square btn-primary flex items-center justify-center'} onClick={refreshStatistics}>
                {loading ? <span className="loading loading-spinner"></span> : <FaSyncAlt />}
              </button>
            </div>
            <ListSearchField onFilterChange={(filterString) => setFilterString(filterString)} />

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
                  ) : cocktailStatisticItems.filter(
                      (item) =>
                        item.cocktail.name.toLowerCase().includes(filterString.toLowerCase()) ||
                        item.cocktailCard?.name.toLowerCase().includes(filterString.toLowerCase()),
                    ).length == 0 ? (
                    <tr>
                      <td colSpan={5} className={'text-center'}>
                        Keine Einträge gefunden
                      </td>
                    </tr>
                  ) : (
                    cocktailStatisticItems
                      .filter(
                        (item) =>
                          item.cocktail.name.toLowerCase().includes(filterString.toLowerCase()) ||
                          item.cocktailCard?.name.toLowerCase().includes(filterString.toLowerCase()),
                      )
                      .sort((a, b) => {
                        return new Date(b.date).getTime() - new Date(a.date).getTime();
                      })
                      .map((item) => (
                        <tr key={'statistic-item-' + item.id}>
                          <td>{new Date(item.date).toFormatDateTimeString()}</td>
                          <td>{item.cocktail.name}</td>
                          <td>{item.cocktailCard?.name}</td>
                          <td>{item.user?.name}</td>
                          <td className={'flex items-center justify-end space-x-2'}>
                            <button
                              disabled={!userContext.isUserPermitted('MANAGER')}
                              className={`btn ${itemDeleting[item.id] ? '' : 'btn-square'} btn-error btn-sm`}
                              onClick={async () => {
                                setItemDeleting({ ...itemDeleting, [item.id]: true });
                                try {
                                  const response = await fetch(`/api/workspaces/${workspaceId}/statistics/cocktails/${item.id}`, {
                                    method: 'DELETE',
                                  });
                                  if (response.ok) {
                                    alertService.success('Statistik-Eintrag gelöscht');
                                    refreshStatistics();
                                  } else {
                                    const body = await response.json();
                                    console.error('StatisticsPage -> deleteStatisticItem', response);
                                    alertService.error(body.message ?? 'Fehler beim Löschen des Statistik-Eintrags', response.status, response.statusText);
                                  }
                                } catch (error) {
                                  console.error('StatisticsPage -> deleteStatisticItem', error);
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
          </div>
        </div>
      </div>
    </ManageEntityLayout>
  );
};

export default StatisticsPage;
