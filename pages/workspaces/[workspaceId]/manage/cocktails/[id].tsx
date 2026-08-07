import { CocktailRecipeForm, CocktailRecipeFormValues } from '@components/cocktails/CocktailRecipeForm';
import { ManageEntityLayout } from '@components/layout/ManageEntityLayout';
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { Loading } from '@components/Loading';
import { alertService } from '@lib/alertService';
import { withPagePermission } from '@middleware/ui/withPagePermission';
import { Role } from '@generated/prisma/client';
import { FormikProps } from 'formik';
import type { CocktailDto } from '@lib/schemas/cocktails';
import { PageCenter } from '@components/layout/PageCenter';
import { UserContext } from '@lib/context/UserContextProvider';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { NotSavedArchiveConfirmation } from '@components/modals/NotSavedArchiveConfirmation';
import { fetchCocktailWithImage } from '@lib/network/cocktails';
import { FaFileDownload, FaHistory } from 'react-icons/fa';
import CocktailExportOptionsModal, { CocktailExportOptions } from '@components/modals/CocktailExportOptionsModal';
import { AuditLogHistoryModal } from '@components/modals/AuditLogHistoryModal';
import { Button, Divider, Loading as UiLoading } from '@components/ui';

function EditCocktailRecipe() {
  const router = useRouter();
  const { t, i18n } = useTranslation(['manage', 'common', 'cocktail', 'errors']);
  const { id, workspaceId } = router.query;

  const userContext = useContext(UserContext);
  const modalContext = useContext(ModalContext);

  const [cocktailRecipe, setCocktailRecipe] = useState<CocktailDto | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [chromiumAvailable, setChromiumAvailable] = useState(false);

  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const formRef = useRef<FormikProps<CocktailRecipeFormValues>>(null);

  const handleExportPdf = useCallback(() => {
    if (!workspaceId || !cocktailRecipe) return;
    modalContext.openModal(
      <CocktailExportOptionsModal
        onExport={async (options: CocktailExportOptions) => {
          setExportingPdf(true);
          try {
            alertService.info(t('cocktail:exportRunningMinutes'));
            const response = await fetch(`/api/v1/workspaces/${workspaceId}/cocktails/export/pdf`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                cocktailIds: [cocktailRecipe.id],
                exportImage: options.exportImage,
                exportDescription: options.exportDescription,
                exportNotes: options.exportNotes,
                exportHistory: options.exportHistory,
                newPagePerCocktail: options.newPagePerCocktail,
                showHeader: options.showHeader,
                showFooter: options.showFooter,
                locale: i18n.language,
              }),
            });

            if (!response.ok) {
              const error = await response.json().catch(() => ({ message: t('errors:export') }));
              alertService.error(error.message ?? t('cocktail:error.exportPdf'), response.status, response.statusText);
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
            alertService.success(t('cocktail:pdfExported'));
          } catch (error) {
            console.error('PDF export error:', error);
            alertService.error(t('cocktail:error.exportPdf'));
          } finally {
            setExportingPdf(false);
          }
        }}
      />,
    );
  }, [workspaceId, cocktailRecipe, modalContext, t]);

  useEffect(() => {
    fetchCocktailWithImage(workspaceId as string, id as string, setCocktailRecipe, setLoading);

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
      title={cocktailRecipe?.isArchived ? <span className={'italic'}>{t('manage:cocktailArchived')}</span> : t('common:cocktail_one')}
      unsavedChanges={unsavedChanges}
      formRef={formRef}
    >
      <CocktailRecipeForm cocktailRecipe={cocktailRecipe} setUnsavedChanges={setUnsavedChanges} formRef={formRef} />
      {cocktailRecipe != undefined && userContext.isUserPermitted(Role.MANAGER) ? (
        <>
          <Divider />
          <div className={'flex items-center justify-end gap-2'}>
            {chromiumAvailable && (
              <Button type="button" variant="outline" size="sm" onClick={handleExportPdf} disabled={exportingPdf}>
                {exportingPdf ? <UiLoading size="sm" /> : <FaFileDownload />}
                {t('manage:exportPdf')}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                modalContext.openModal(<AuditLogHistoryModal entityType={'CocktailRecipe'} entityId={cocktailRecipe.id} entityName={cocktailRecipe.name} />)
              }
            >
              <FaHistory />
              {t('manage:history')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                const archiveFunction = async () => {
                  const response = await fetch(
                    `/api/v1/workspaces/${workspaceId}/cocktails/${cocktailRecipe?.id}/${cocktailRecipe?.isArchived ? 'unarchive' : 'archive'}`,
                    {
                      method: 'PUT',
                    },
                  );

                  const body = await response.json();
                  if (response.ok) {
                    router
                      .replace(`/workspaces/${workspaceId}/manage/cocktails`)
                      .then(() => alertService.success(cocktailRecipe?.isArchived ? t('cocktail:unarchivedSuccess') : t('cocktail:archivedSuccess')));
                  } else {
                    console.error('CocktailId -> (un)archive', response);
                    alertService.error(
                      body.error?.message ?? body.message ?? (cocktailRecipe?.isArchived ? t('cocktail:unarchiveError') : t('cocktail:archiveError')),
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
              {cocktailRecipe?.isArchived ? t('cocktail:unarchiveCocktail') : t('cocktail:archiveCocktail')}
            </Button>
          </div>
        </>
      ) : (
        <></>
      )}
    </ManageEntityLayout>
  );
}

export default withPagePermission([Role.MANAGER], EditCocktailRecipe, '/workspaces/[workspaceId]/manage');
