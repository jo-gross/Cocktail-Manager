import { CocktailRecipeForm } from '../../../../../components/cocktails/CocktailRecipeForm';
import { ManageEntityLayout } from '../../../../../components/layout/ManageEntityLayout';
import React, { useContext, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { Loading } from '../../../../../components/Loading';
import { alertService } from '../../../../../lib/alertService';
import { withPagePermission } from '../../../../../middleware/ui/withPagePermission';
import { Role } from '@prisma/client';
import { FormikProps } from 'formik';
import { CocktailRecipeFullWithImage } from '../../../../../models/CocktailRecipeFullWithImage';
import { PageCenter } from '../../../../../components/layout/PageCenter';
import { UserContext } from '../../../../../lib/context/UserContextProvider';
import { ModalContext } from '../../../../../lib/context/ModalContextProvider';
import { NotSavedArchiveConfirmation } from '../../../../../components/modals/NotSavedArchiveConfirmation';
import { fetchCocktailWithImage } from '../../../../../lib/network/cocktails';

function EditCocktailRecipe() {
  const router = useRouter();
  const { id, workspaceId } = router.query;

  const userContext = useContext(UserContext);
  const modalContext = useContext(ModalContext);

  const [cocktailRecipe, setCocktailRecipe] = useState<CocktailRecipeFullWithImage | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const formRef: any = useRef<FormikProps<any>>(null);

  useEffect(() => {
    fetchCocktailWithImage(workspaceId as string, id as string, setCocktailRecipe, setLoading);
  }, []);

  return loading ? (
    <PageCenter>
      <Loading />
    </PageCenter>
  ) : (
    <ManageEntityLayout
      backLink={`/workspaces/${workspaceId}/manage/cocktails`}
      title={cocktailRecipe?.isArchived ? <span className={'italic'}>Cocktail (archiviert)</span> : 'Cocktail'}
      unsavedChanges={unsavedChanges}
      formRef={formRef}
    >
      <CocktailRecipeForm cocktailRecipe={cocktailRecipe} setUnsavedChanges={setUnsavedChanges} formRef={formRef} />
      {cocktailRecipe != undefined && userContext.isUserPermitted(Role.MANAGER) ? (
        <>
          <div className={'divider'}></div>
          <div className={'flex items-center justify-end gap-2'}>
            <button
              type={'button'}
              className={'btn btn-outline btn-sm'}
              onClick={async () => {
                const archiveFunction = async () => {
                  const response = await fetch(
                    `/api/workspaces/${workspaceId}/cocktails/${cocktailRecipe?.id}/${cocktailRecipe?.isArchived ? 'unarchive' : 'archive'}`,
                    {
                      method: 'PUT',
                    },
                  );

                  const body = await response.json();
                  if (response.ok) {
                    router
                      .replace(`/workspaces/${workspaceId}/manage/cocktails`)
                      .then(() => alertService.success(`Cocktail ${cocktailRecipe?.isArchived ? 'entarchiviert' : 'archiviert'}`));
                  } else {
                    console.error('CocktailId -> (un)archive', response);
                    alertService.error(
                      body.message ?? `Fehler beim ${cocktailRecipe?.isArchived ? 'Entarchivieren' : 'Archivieren'} der Karte`,
                      response.status,
                      response.statusText,
                    );
                  }
                };

                if (unsavedChanges) {
                  modalContext.openModal(<NotSavedArchiveConfirmation archive={!cocktailRecipe.isArchived} onArchive={archiveFunction} />);
                } else {
                  await archiveFunction();
                }
              }}
            >
              {cocktailRecipe?.isArchived ? 'Cocktail entarchivieren' : 'Cocktail archivieren'}
            </button>
          </div>
        </>
      ) : (
        <></>
      )}
    </ManageEntityLayout>
  );
}

export default withPagePermission([Role.MANAGER], EditCocktailRecipe, '/workspaces/[workspaceId]/manage');
