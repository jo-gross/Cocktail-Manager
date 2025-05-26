import Link from 'next/link';
import { ManageEntityLayout } from '@components/layout/ManageEntityLayout';
import { ManageColumn } from '@components/ManageColumn';
import React, { useCallback, useEffect, useState } from 'react';
import { Loading } from '@components/Loading';
import { useRouter } from 'next/router';
import { alertService } from '@lib/alertService';
import { CocktailCalculationOverview } from '../../../../../models/CocktailCalculationOverview';
import { Role } from '@generated/prisma/client';
import { FaPlus } from 'react-icons/fa';
import ListSearchField from '../../../../../components/ListSearchField';

export default function CocktailCalculationOverviewPage() {
  const router = useRouter();
  const { workspaceId } = router.query;

  const [cocktailCalculations, setCocktailCalculations] = useState<CocktailCalculationOverview[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterString, setFilterString] = useState('');

  const refreshCocktailCalculations = useCallback(() => {
    if (!workspaceId) return;
    setLoading(true);
    fetch(`/api/workspaces/${workspaceId}/calculations`)
      .then(async (response) => {
        const body = await response.json();
        if (response.ok) {
          setCocktailCalculations(body.data);
        } else {
          console.error('Calculation -> refreshCocktailCalculations', response);
          alertService.error(body.message ?? 'Fehler beim Laden der Kalkulationen', response.status, response.statusText);
        }
      })
      .catch((error) => {
        console.error('Calculation -> refreshCocktailCalculations', error);
        alertService.error('Fehler beim Laden der Kalkulationen');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [workspaceId]);

  useEffect(() => {
    refreshCocktailCalculations();
  }, [refreshCocktailCalculations]);

  return (
    <ManageEntityLayout
      backLink={`/workspaces/${workspaceId}/manage`}
      title={'Kalkulationen'}
      actions={
        <Link href={`/workspaces/${workspaceId}/manage/calculations/create`}>
          <div className={'btn btn-square btn-primary btn-sm md:btn-md'}>
            <FaPlus />
          </div>
        </Link>
      }
    >
      <div className={'card'}>
        <div className={'card-body'}>
          <ListSearchField onFilterChange={(filterString) => setFilterString(filterString)} />
          <div className="overflow-x-auto">
            <table className="table-compact table table-zebra w-full">
              <thead>
                <tr>
                  <th className="">Name</th>
                  <th className="">Cocktails</th>
                  <th className="">Bearbeitet von</th>
                  <th className="flex justify-end"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr className={'w-full'}>
                    <td colSpan={4}>
                      <Loading />
                    </td>
                  </tr>
                ) : cocktailCalculations.filter((cocktailCalculation) => cocktailCalculation.name.toLowerCase().includes(filterString.toLowerCase())).length ==
                  0 ? (
                  <tr>
                    <td colSpan={4} className={'text-center'}>
                      Keine Einträge gefunden
                    </td>
                  </tr>
                ) : (
                  cocktailCalculations
                    .filter((cocktailCalculation) => cocktailCalculation.name.toLowerCase().includes(filterString.toLowerCase()))
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((cocktailCalculation) => (
                      <tr key={cocktailCalculation.id}>
                        <td>{cocktailCalculation.name}</td>
                        <td>
                          {cocktailCalculation.cocktailCalculationItems
                            .map((calculationItem) => calculationItem.cocktail.name)
                            .sort((a, b) => a.localeCompare(b))
                            .join(', ')}
                        </td>
                        <td>{cocktailCalculation.updatedByUser.name}</td>
                        <ManageColumn
                          entity={'calculations'}
                          name={cocktailCalculation.name}
                          id={cocktailCalculation.id}
                          onRefresh={refreshCocktailCalculations}
                          editRole={Role.USER}
                          deleteRole={Role.ADMIN}
                        />
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
