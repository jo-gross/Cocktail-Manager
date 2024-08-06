import { Role } from '@prisma/client';
import Link from 'next/link';
import { ManageEntityLayout } from '../../../../../components/layout/ManageEntityLayout';
import { ManageColumn } from '../../../../../components/ManageColumn';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Loading } from '../../../../../components/Loading';
import { useRouter } from 'next/router';
import { alertService } from '../../../../../lib/alertService';
import { UserContext } from '../../../../../lib/context/UserContextProvider';
import AvatarImage from '../../../../../components/AvatarImage';
import { FaArrowDown, FaArrowUp, FaPlus } from 'react-icons/fa';
import ListSearchField from '../../../../../components/ListSearchField';
import { CocktailRecipeModel } from '../../../../../models/CocktailRecipeModel';
import _ from 'lodash';
import { cocktailFilter } from '../../../../../lib/cocktailFilter';

export default function CocktailsOverviewPage() {
  const router = useRouter();
  const { workspaceId } = router.query;

  const userContext = useContext(UserContext);

  const [cocktailRecipes, setCocktailRecipes] = useState<CocktailRecipeModel[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterString, setFilterString] = useState('');

  const [collapsedArchived, setCollapsedArchived] = useState(true);

  const refreshCocktails = useCallback(() => {
    if (!workspaceId) return;
    setLoading(true);
    fetch(`/api/workspaces/${workspaceId}/cocktails`)
      .then(async (response) => {
        const body = await response.json();
        if (response.ok) {
          setCocktailRecipes(body.data);
        } else {
          console.error('Cocktails -> fetchCocktails', response);
          alertService.error(body.message ?? 'Fehler beim Laden der Cocktails', response.status, response.statusText);
        }
      })
      .catch((error) => {
        console.error('Cocktails -> fetchCocktails', error);
        alertService.error('Fehler beim Laden der Cocktails');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [workspaceId]);

  useEffect(() => {
    refreshCocktails();
  }, [refreshCocktails]);

  const renderTableRows = (recipes: CocktailRecipeModel[], isArchived: boolean) => {
    return recipes
      .filter((cocktail) => cocktailFilter(cocktail, filterString))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((cocktailRecipe) => (
        <tr key={cocktailRecipe.id} className={''}>
          <td>
            <div className="flex items-center space-x-3">
              {cocktailRecipe._count.CocktailRecipeImage === 0 ? null : (
                <div className="h-12 w-12">
                  <AvatarImage src={`/api/workspaces/${cocktailRecipe.workspaceId}/cocktails/${cocktailRecipe.id}/image`} alt={'Cocktail'} />
                </div>
              )}
            </div>
          </td>
          <td className={isArchived ? 'italic' : ''}>
            {cocktailRecipe.name} {isArchived && '(Archiviert)'}
          </td>
          <td className={''}>
            <span className={'whitespace-nowrap'}>{cocktailRecipe.price ?? '-'} €</span>
          </td>
          <td className={'flex items-center gap-1'}>
            {cocktailRecipe.tags.map((tag) => (
              <div key={`cocktail-${cocktailRecipe.id}-tags-${tag}`} className={'badge badge-primary'}>
                {tag}
              </div>
            ))}
          </td>
          <ManageColumn entity={'cocktails'} id={cocktailRecipe.id} onRefresh={refreshCocktails} />
        </tr>
      ));
  };

  const groupedCocktails = _.groupBy(cocktailRecipes, 'isArchived');

  return (
    <ManageEntityLayout
      backLink={`/workspaces/${workspaceId}/manage`}
      title={'Cocktails'}
      actions={
        userContext.isUserPermitted(Role.MANAGER) ? (
          <Link href={`/workspaces/${workspaceId}/manage/cocktails/create`}>
            <div className={'btn btn-square btn-primary btn-sm md:btn-md'}>
              <FaPlus />
            </div>
          </Link>
        ) : undefined
      }
    >
      <div className={'card'}>
        <div className={'card-body'}>
          <ListSearchField onFilterChange={(filterString) => setFilterString(filterString)} />
          <div className="overflow-x-auto">
            <table className="table table-zebra w-full">
              <thead>
                <tr>
                  <th className=""></th>
                  <th className="">Name</th>
                  <th className="">Preis</th>
                  <th className="">Tags</th>
                  <th className="flex justify-end"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr className={'w-full'}>
                    <td colSpan={5}>
                      <Loading />
                    </td>
                  </tr>
                ) : (
                  <>
                    {groupedCocktails['false'].filter((cocktail) => cocktailFilter(cocktail, filterString)).length == 0 ? (
                      <tr>
                        <td colSpan={5}>Keine Cocktails gefunden</td>
                      </tr>
                    ) : (
                      <>{renderTableRows(groupedCocktails['false'] || [], false)}</>
                    )}
                    {(groupedCocktails['true'] || []).filter((cocktail) => cocktailFilter(cocktail, filterString)).length > 0 && (
                      <>
                        <tr onClick={() => setCollapsedArchived(!collapsedArchived)}>
                          <td colSpan={4}>Archiviert</td>
                          <td className={'flex items-center justify-end'}>
                            <div className={'p-2'}>{collapsedArchived ? <FaArrowUp /> : <FaArrowDown />}</div>
                          </td>
                        </tr>
                        {!collapsedArchived && renderTableRows(groupedCocktails['true'], true)}
                      </>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </ManageEntityLayout>
  );
}
