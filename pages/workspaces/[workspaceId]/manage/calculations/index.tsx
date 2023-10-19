import Link from 'next/link';
import { ManageEntityLayout } from '../../../../../components/layout/ManageEntityLayout';
import { ManageColumn } from '../../../../../components/ManageColumn';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Loading } from '../../../../../components/Loading';
import { useRouter } from 'next/router';
import { alertService } from '../../../../../lib/alertService';
import { UserContext } from '../../../../../lib/context/UserContextProvider';
import { CocktailCalculationOverview } from '../../../../../models/CocktailCalculationOverview';
import { Role } from '@prisma/client';

export default function CocktailCalculationOverviewPage() {
  const router = useRouter();
  const { workspaceId } = router.query;

  const userContext = useContext(UserContext);

  const [cocktailCalculations, setCocktailCalculations] = useState<CocktailCalculationOverview[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshCocktailCalculations = useCallback(() => {
    if (!workspaceId) return;
    fetch(`/api/workspaces/${workspaceId}/calculations`)
      .then(async (response) => {
        const body = await response.json();
        if (response.ok) {
          setCocktailCalculations(body.data);
        } else {
          console.log('Calculation -> refreshCocktailCalculations', response, body);
          alertService.error(body.message, response.status, response.statusText);
        }
      })
      .catch((err) => alertService.error(err.message))
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
          <div className={'btn btn-primary'}>Erstellen</div>
        </Link>
      }
    >
      <div className={'card'}>
        <div className={'card-body'}>
          <div className="overflow-x-auto">
            <table className="table table-compact w-full">
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
                ) : cocktailCalculations.length == 0 ? (
                  <tr>
                    <td colSpan={4} className={'text-center'}>
                      Keine Einträge gefunden
                    </td>
                  </tr>
                ) : (
                  cocktailCalculations
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
