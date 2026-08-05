import { ManageEntityLayout } from '@components/layout/ManageEntityLayout';
import { PageCenter } from '@components/layout/PageCenter';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Loading } from '@components/Loading';
import { withPagePermission } from '@middleware/ui/withPagePermission';
import { Role } from '@generated/prisma/client';
import type { CardDto } from '@lib/schemas/cards';
import type { CocktailSummaryDto } from '@lib/schemas/cocktails';
import { CardEditorArchiveActions, CardEditorForm } from '@components/card-editor/CardEditorForm';
import { apiV1FetchSafe } from '@lib/network/apiV1';

function EditCocktailCard() {
  const router = useRouter();
  const { id, workspaceId } = router.query;

  const [card, setCard] = useState<CardDto | undefined>(undefined);
  const [loadingCard, setLoadingCard] = useState<boolean>(false);
  const [cocktails, setCocktails] = useState<CocktailSummaryDto[]>([]);
  const [loadingCocktails, setLoadingCocktails] = useState<boolean>(false);
  const [unsavedChanges, setUnsavedChanges] = useState(false);

  useEffect(() => {
    if (!id || !workspaceId) return;
    setLoadingCard(true);
    apiV1FetchSafe<CardDto>(`/api/v1/workspaces/${workspaceId}/cards/${id}`, undefined, 'Fehler beim Laden der Karte')
      .then((data) => {
        if (data) setCard(data);
      })
      .finally(() => {
        setLoadingCard(false);
      });

    setLoadingCocktails(true);
    apiV1FetchSafe<CocktailSummaryDto[]>(`/api/v1/workspaces/${workspaceId}/cocktails`, undefined, 'Fehler beim Laden der Cocktails')
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
      title={card?.archived ? <span className={'italic'}>Karte (archiviert)</span> : 'Karte'}
      unsavedChanges={unsavedChanges}
    >
      <CardEditorForm
        card={card}
        cocktails={cocktails}
        loadingCocktails={loadingCocktails}
        workspaceId={workspaceId as string}
        onUnsavedChangesChange={setUnsavedChanges}
      />
      {card != undefined ? <CardEditorArchiveActions card={card} workspaceId={workspaceId as string} /> : null}
    </ManageEntityLayout>
  );
}

export default withPagePermission([Role.MANAGER], EditCocktailCard, '/workspaces/[workspaceId]/manage');
