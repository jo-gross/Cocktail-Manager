import { ManageEntityLayout } from '@components/layout/ManageEntityLayout';
import { PageCenter } from '@components/layout/PageCenter';
import React, { useEffect, useRef, useState } from 'react';
import type { FormikProps } from 'formik';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { Loading } from '@components/Loading';
import { withPagePermission } from '@middleware/ui/withPagePermission';
import { Role } from '@generated/prisma/client';
import type { CardDto } from '@lib/schemas/cards';
import type { CocktailSummaryDto } from '@lib/schemas/cocktails';
import { CardEditorArchiveActions, CardEditorForm } from '@components/card-editor/CardEditorForm';
import type { CardEditorFormValues } from '@components/card-editor/types';
import { apiV1FetchSafe } from '@lib/network/apiV1';
import { Badge } from '@components/ui';

function EditCocktailCard() {
  const router = useRouter();
  const { t } = useTranslation(['manage', 'common', 'cocktail', 'errors', 'nav']);
  const { id, workspaceId } = router.query;

  const [card, setCard] = useState<CardDto | undefined>(undefined);
  const [loadingCard, setLoadingCard] = useState<boolean>(false);
  const [cocktails, setCocktails] = useState<CocktailSummaryDto[]>([]);
  const [loadingCocktails, setLoadingCocktails] = useState<boolean>(false);
  const formRef = useRef<FormikProps<CardEditorFormValues>>(null);

  useEffect(() => {
    if (!id || !workspaceId) return;
    setLoadingCard(true);
    apiV1FetchSafe<CardDto>(`/api/v1/workspaces/${workspaceId}/cards/${id}`, undefined, t('errors:loadCard'))
      .then((data) => {
        if (data) setCard(data);
      })
      .finally(() => {
        setLoadingCard(false);
      });

    setLoadingCocktails(true);
    apiV1FetchSafe<CocktailSummaryDto[]>(`/api/v1/workspaces/${workspaceId}/cocktails`, undefined, t('cocktail:error.load'))
      .then((data) => {
        if (data) setCocktails(data);
      })
      .finally(() => {
        setLoadingCocktails(false);
      });
  }, [id, workspaceId]);

  return loadingCard ? (
    <PageCenter>
      <Loading />
    </PageCenter>
  ) : (
    <ManageEntityLayout
      backLink={`/workspaces/${workspaceId}/manage/cards`}
      title={card?.name || t('manage:card')}
      subtitle={
        card ? (
          <span className="inline-flex items-center gap-2">
            {t('nav:cards')}
            {card.archived && <Badge variant="warning">{t('common:archived')}</Badge>}
          </span>
        ) : undefined
      }
      formRef={formRef}
      showUnsavedHint={false}
    >
      <CardEditorForm card={card} cocktails={cocktails} loadingCocktails={loadingCocktails} workspaceId={workspaceId as string} formRef={formRef} />
      {card != undefined ? <CardEditorArchiveActions card={card} workspaceId={workspaceId as string} /> : null}
    </ManageEntityLayout>
  );
}

export default withPagePermission([Role.MANAGER], EditCocktailCard, '/workspaces/[workspaceId]/manage');
