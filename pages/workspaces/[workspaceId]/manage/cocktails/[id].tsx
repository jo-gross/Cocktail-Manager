import { CocktailRecipeForm } from '@components/cocktails/CocktailRecipeForm';
import { ManageEntityLayout } from '@components/layout/ManageEntityLayout';
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { Loading } from '@components/Loading';
import { alertService } from '@lib/alertService';
import { withPagePermission } from '@middleware/ui/withPagePermission';
import { Role } from '@generated/prisma/client';
import { FormikProps } from 'formik';
import { CocktailRecipeFullWithImage } from '../../../../../models/CocktailRecipeFullWithImage';
import { PageCenter } from '@components/layout/PageCenter';
import { UserContext } from '@lib/context/UserContextProvider';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { NotSavedArchiveConfirmation } from '@components/modals/NotSavedArchiveConfirmation';
import { fetchCocktailWithImage } from '@lib/network/cocktails';
import { FaFileDownload } from 'react-icons/fa';

function EditCocktailRecipe() {
  const router = useRouter();
  const { id, workspaceId } = router.query;

  const userContext = useContext(UserContext);
  const modalContext = useContext(ModalContext);

  const [cocktailRecipe, setCocktailRecipe] = useState<CocktailRecipeFullWithImage | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [chromiumAvailable, setChromiumAvailable] = useState(false);

  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const formRef: any = useRef<FormikProps<any>>(null);

  const handleExportPdf = useCallback(async () => {
    if (!workspaceId || !cocktailRecipe) return;
    setExportingPdf(true);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/cocktails/export-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cocktailIds: [cocktailRecipe.id] }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Fehler beim Exportieren' }));
        alertService.error(error.message ?? 'Fehler beim Exportieren des PDFs', response.status, response.statusText);
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cocktail-${cocktailRecipe.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      alertService.success('PDF erfolgreich exportiert');
    } catch (error) {
      console.error('PDF export error:', error);
      alertService.error('Fehler beim Exportieren des PDFs');
    } finally {
      setExportingPdf(false);
    }
  }, [workspaceId, cocktailRecipe]);

  useEffect(() => {
    fetchCocktailWithImage(workspaceId as string, id as string, setCocktailRecipe, setLoading);

    // Check if Chromium service is available
    fetch('/api/chromium-status')
      .then((res) => res.json())
      .then((data) => {
        setChromiumAvailable(data.available || false);
      })
      .catch((error) => {
        console.error('Error checking Chromium status:', error);
        setChromiumAvailable(false);
      });
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
            {chromiumAvailable && (
              <button type={'button'} className={'btn btn-outline btn-sm'} onClick={handleExportPdf} disabled={exportingPdf} title="Als PDF exportieren">
                {exportingPdf ? <span className={'loading loading-spinner'} /> : <FaFileDownload />}
                PDF exportieren
              </button>
            )}
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
