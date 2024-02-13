import { ManageEntityLayout } from '../../../../../components/layout/ManageEntityLayout';
import { useRouter } from 'next/router';
import { useCallback, useContext, useEffect, useState } from 'react';
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
import ListSearchField from '../../../../../components/ListSearchField';

ChartJS.register(ArcElement, Tooltip, Legend, TimeScale, CategoryScale, LinearScale);

export default function StatisticsPage() {
  const router = useRouter();
  const { workspaceId } = router.query;
  const userContext = useContext(UserContext);

  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());

  const [cocktailStatisticItems, setCocktailStatisticItems] = useState<CocktailStatisticItemFull[]>([]);
  const [loading, setLoading] = useState(false);

  const [filterString, setFilterString] = useState('');

  const refreshStatistics = useCallback(async () => {
    if (!workspaceId) return;
    if (loading) return;
    try {
      setLoading(true);
      const response = await fetch(`/api/workspaces/${workspaceId}/statistics/cocktails?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`);
      if (response.ok) {
        const body = await response.json();
        setCocktailStatisticItems(body.data);
      } else {
        console.error('StatisticsPage -> refreshStatistics', response);
        const body = await response.json();
        alertService.error(body.message, response.status, response.statusText);
      }
    } catch (error) {
      console.error('StatisticsPage -> refreshStatistics', error);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, workspaceId]);

  useEffect(() => {
    refreshStatistics();
  }, [startDate, endDate]);

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

    data.forEach((entry) => {
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

    const labels = Object.keys(hourlyCocktails).sort();
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
        <div key={'startDate'} className={'form-control'}>
          <label className={'lable'}>Startdatum</label>
          <input
            className={'input input-bordered'}
            type={'date'}
            value={startDate.toISOString().split('T')[0]}
            onChange={(event) => {
              const startDate = new Date(event.target.value);
              if (startDate.getTime() > endDate.getTime()) {
                setEndDate(startDate);
              }
              setStartDate(startDate);
            }}
          />
        </div>,
        <div key={'endDate'} className={'form-control'}>
          <label className={'lable'}>
            <span className={'lable-text'}>Enddatum</span>
          </label>
          <input
            className={`input input-bordered`}
            type={'date'}
            value={endDate.toISOString().split('T')[0]}
            onChange={(event) => {
              const date = new Date(event.target.value);
              if (date.getTime() < startDate.getTime()) {
                setStartDate(date);
              }
              setEndDate(date);
            }}
          />
        </div>,
      ]}
    >
      <div className={'grid grid-cols-1 gap-2 xl:grid-cols-2'}>
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
                    .map((cocktailStatisticItems, cocktailId) => ({ name: cocktailStatisticItems[0].cocktail.name, count: cocktailStatisticItems.length }))
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
                      .map((cocktailStatisticItems, cocktailId) => ({ name: cocktailStatisticItems[0].cocktail.name, count: cocktailStatisticItems.length }))
                      .orderBy('count', 'desc')
                      .map((cocktailStatisticItem) => cocktailStatisticItem.name)
                      .value(),
                    datasets: [
                      {
                        label: 'Anzahl',
                        data: _.chain(cocktailStatisticItems)
                          .groupBy('cocktailId')
                          .map((cocktailStatisticItems, cocktailId) => ({
                            name: cocktailStatisticItems[0].cocktail.name,
                            count: cocktailStatisticItems.length,
                          }))
                          .orderBy('count', 'desc')
                          .map((cocktailStatisticItem) => cocktailStatisticItem.count)
                          .value(),
                        backgroundColor: _.chain(cocktailStatisticItems)
                          .groupBy('cocktailId')
                          .map((cocktailStatisticItems, cocktailId) => ({
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
                      // type: 'time',
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
                        Lade...
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
                              className={'btn btn-square btn-error btn-sm'}
                              onClick={async () => {
                                try {
                                  const response = await fetch(`/api/workspaces/${workspaceId}/statistics/cocktails/${item.id}`, {
                                    method: 'DELETE',
                                  });
                                  if (response.ok) {
                                    alertService.success('Statistik Eintrag gelöscht');
                                    refreshStatistics();
                                  } else {
                                    console.error('StatisticsPage -> refreshStatistics', response);
                                    const body = await response.json();
                                    alertService.error(body.message, response.status, response.statusText);
                                  }
                                } catch (error) {
                                  console.error('StatisticsPage -> refreshStatistics', error);
                                  alertService.error('Fehler beim Löschen des Statistik Eintrags');
                                }
                              }}
                            >
                              <FaTrashAlt />
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
