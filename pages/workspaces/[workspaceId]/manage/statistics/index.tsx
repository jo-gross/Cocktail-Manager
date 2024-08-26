import { ManageEntityLayout } from '../../../../../components/layout/ManageEntityLayout';
import { useRouter } from 'next/router';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { CocktailStatisticItemFull } from '../../../../../models/CocktailStatisticItemFull';
import { alertService } from '../../../../../lib/alertService';
import { FaSyncAlt, FaTrashAlt } from 'react-icons/fa';
import _ from 'lodash';
import { UserContext } from '../../../../../lib/context/UserContextProvider';
import { ArcElement, CategoryScale, Legend, LinearScale, TimeScale, Tooltip } from 'chart.js';
import { Chart as ChartJS } from 'chart.js/auto';
import { Bar, Doughnut } from 'react-chartjs-2';
import '../../../../../lib/DateUtils';
import '../../../../../lib/StringUtils';
import { Loading } from '../../../../../components/Loading';
import ListSearchField from '../../../../../components/ListSearchField';

ChartJS.register(ArcElement, Tooltip, Legend, TimeScale, CategoryScale, LinearScale);

export default function StatisticsPage() {
  const router = useRouter();
  const { workspaceId } = router.query;
  const userContext = useContext(UserContext);

  const [startDate, setStartDate] = useState<Date>(typeof router.query.startDate === 'string' ? new Date(router.query.startDate) : new Date());
  const [endDate, setEndDate] = useState<Date>(typeof router.query.endDate === 'string' ? new Date(router.query.endDate) : new Date());

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
  }, [startDate, endDate, refreshStatistics]);

  interface ProcessedData {
    labels: string[];
    datasets: {
      label: string;
      data: number[];
      backgroundColor: string;
    }[];
  }

  function processData(data: CocktailStatisticItemFull[]): ProcessedData {
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
                        <span>{cocktailStatisticItem.count}</span>
                      </div>
                    ))
                    .value()}
                </div>
                <div className={'divider-sm'}></div>
                <div>
                  <strong>Cocktails in Summe: </strong>
                  {cocktailStatisticItems.length}
                </div>
              </div>
              <div className={'h-full max-h-96'}>
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
                    plugins: {
                      legend: {
                        position: 'right',
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
            <div>
              <Bar
                className={'w'}
                data={processData(cocktailStatisticItems)}
                options={{
                  responsive: true,
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
                      position: 'right',
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
}
