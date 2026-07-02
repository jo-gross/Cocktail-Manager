import { ManageEntityLayout } from '@components/layout/ManageEntityLayout';
import { PageCenter } from '@components/layout/PageCenter';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Loading } from '@components/Loading';
import { alertService } from '@lib/alertService';
import { withPagePermission } from '@middleware/ui/withPagePermission';
import { Role } from '@generated/prisma/client';
import { CocktailCardFull } from '../../../../../models/CocktailCardFull';
import { CocktailRecipeFull } from '../../../../../models/CocktailRecipeFull';
import { CardEditorArchiveActions, CardEditorForm } from '@components/card-editor/CardEditorForm';

function EditCocktailCard() {
  const router = useRouter();
  const { id, workspaceId } = router.query;

  const [card, setCard] = useState<CocktailCardFull | undefined>(undefined);
  const [loadingCard, setLoadingCard] = useState<boolean>(false);
  const [cocktails, setCocktails] = useState<CocktailRecipeFull[]>([]);
  const [loadingCocktails, setLoadingCocktails] = useState<boolean>(false);
  const [unsavedChanges, setUnsavedChanges] = useState(false);

  useEffect(() => {
    if (!id || !workspaceId) return;
    setLoadingCard(true);
    fetch(`/api/workspaces/${workspaceId}/cards/${id}`)
      .then(async (response) => {
        const body = await response.json();
        if (response.ok) {
          setCard(body.data);
        } else {
          console.error('CardId -> fetchCard', response);
          alertService.error(body.message ?? 'Fehler beim Laden der Karte', response.status, response.statusText);
        }
      })
      .catch((error) => {
        console.error('CardId -> fetchCard', error);
        alertService.error('Fehler beim Laden der Karte');
      })
      .finally(() => {
        setLoadingCard(false);
      });

    setLoadingCocktails(true);
    fetch(`/api/workspaces/${workspaceId}/cocktails`)
      .then(async (response) => {
        const body = await response.json();
        if (response.ok) {
          setCocktails(body.data);
        } else {
          console.error('CardId -> fetchCocktails', response);
          alertService.error(body.message ?? 'Fehler beim Laden der Cocktails', response.status, response.statusText);
        }
      })
      .catch((error) => {
        console.error('CardId -> fetchCocktails', error);
        alertService.error('Fehler beim Laden der Cocktails');
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
