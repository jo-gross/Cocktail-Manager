import { ManageEntityLayout } from '../../../../../components/layout/ManageEntityLayout';
import { useRouter } from 'next/router';
import { useCallback, useContext, useEffect, useState } from 'react';
import { CocktailStatisticItemFull } from '../../../../../models/CocktailStatisticItemFull';
import { alertService } from '../../../../../lib/alertService';
import { FaSyncAlt, FaTrashAlt } from 'react-icons/fa';
import _ from 'lodash';
import { UserContext } from '../../../../../lib/context/UserContextProvider';

export default function StatisticsPage() {
  const router = useRouter();
  const { workspaceId } = router.query;
  const userContext = useContext(UserContext);

  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());

  const [cocktailStatisticItems, setCocktailStatisticItems] = useState<CocktailStatisticItemFull[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshStatistics = useCallback(async () => {
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

  return (
    <ManageEntityLayout
      title={'Statistiken'}
      backLink={`/workspaces/${workspaceId}/manage`}
      actions={[
        <div key={'startDate'} className={'form-control'}>
          <label className={'lable'}>Startdatum</label>
          <input
            className={'input'}
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
            className={`input`}
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
      <div className={'grid grid-cols-1 gap-2 md:grid-cols-2'}>
        <div className={'card'}>
          <div className={'card-body'}>
            <div className={'card-title'}>
              Übersicht ({startDate.toLocaleDateString()} - {endDate.toLocaleDateString()})
            </div>
            {_.chain(cocktailStatisticItems)
              .groupBy('cocktailId')
              .map((cocktailStatisticItems, cocktailId) => ({ name: cocktailStatisticItems[0].cocktail.name, count: cocktailStatisticItems.length }))
              .orderBy('count', 'desc')
              .map((cocktailStatisticItem) => (
                <div key={''}>
                  <span className={'font-bold'}>{cocktailStatisticItem.name}: </span>
                  <span>{cocktailStatisticItem.count}</span>
                </div>
              ))
              .value()}
          </div>
        </div>
        <div className={'card col-span-12'}>
          <div className={'card-body'}>
            <div className={'card-title flex w-full justify-between'}>
              Logs
              <button className={'btn btn-square btn-primary flex items-center justify-center'} onClick={refreshStatistics}>
                {loading ? <span className="loading loading-spinner"></span> : <FaSyncAlt />}
              </button>
            </div>
            <table className={'table-compact overflow-x table'}>
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
                ) : cocktailStatisticItems.length == 0 ? (
                  <tr>
                    <td colSpan={5} className={'text-center'}>
                      Keine Einträge gefunden
                    </td>
                  </tr>
                ) : (
                  cocktailStatisticItems
                    .sort((a, b) => {
                      return new Date(b.date).getTime() - new Date(a.date).getTime();
                    })
                    .map((item) => (
                      <tr key={item.id}>
                        <td>{new Date(item.date).toLocaleString()}</td>
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
    </ManageEntityLayout>
  );
}
