import { addCocktailToQueue, addCocktailToStatistic } from '@lib/network/cocktailTracking';
import { MdPlaylistAdd } from 'react-icons/md';
import { FaCheck } from 'react-icons/fa';
import React, { useContext, useState } from 'react';
import { ModalContext } from '@lib/context/ModalContextProvider';
import AddCocktailToQueueModal from './modals/AddCocktailToQueueModal';
import SelectSpecifyCocktailForStatisticModal from './modals/SelectSpecifyCocktailForStatisticModal';
import { useOffline } from '@lib/context/OfflineContextProvider';
import { Button, Loading, Tooltip } from '@components/ui';

interface StatisticActionsProps {
  workspaceId: string;
  cocktailId: string;
  cocktailName: string;

  cardId?: string;
  actionSource: 'SEARCH_MODAL' | 'CARD' | 'DETAIL_MODAL' | 'QUEUE';
  notes?: string;
  disabled?: { list?: boolean; listWithNote?: boolean; markAsDone?: boolean };
  initData?: { comment?: string };
  onAddToQueue?: () => void;
  onMarkedAsDone?: () => void;
}

export default function StatisticActions({
  workspaceId,
  cocktailId,
  cardId,
  actionSource,
  disabled,
  notes,
  initData,
  onMarkedAsDone,
  onAddToQueue: _onAddToQueue,
  cocktailName,
}: StatisticActionsProps) {
  const [submittingQueue, setSubmittingQueue] = useState(false);
  const [submittingStatistic, setSubmittingStatistic] = useState(false);

  const modalContext = useContext(ModalContext);
  const { isOnline, isOfflineMode } = useOffline();

  const isOffline = !isOnline || isOfflineMode;
  const offlineTip = isOffline ? 'Nicht verfügbar im Offline-Modus' : undefined;

  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-2 2xl:grid-cols-3">
      <Tooltip tip={offlineTip} className="w-full">
        <Button
          variant="outline"
          className="w-full flex-1"
          type="button"
          onClick={() =>
            addCocktailToQueue({
              workspaceId: workspaceId,
              cocktailId: cocktailId,
              setSubmitting: setSubmittingQueue,
            })
          }
          disabled={submittingQueue || disabled?.list || isOffline}
        >
          <MdPlaylistAdd />
          Liste
          {submittingQueue ? <Loading size="sm" /> : null}
        </Button>
      </Tooltip>

      <Tooltip tip={offlineTip} className="w-full">
        <Button
          variant="outline"
          className="w-full flex-1"
          type="button"
          onClick={() =>
            modalContext.openModal(
              <AddCocktailToQueueModal
                workspaceId={workspaceId}
                cocktailId={cocktailId}
                actionSource={actionSource}
                cocktailName={cocktailName}
                initComment={initData?.comment}
              />,
            )
          }
          disabled={submittingQueue || disabled?.listWithNote || isOffline}
        >
          <MdPlaylistAdd />
          mit Notiz
          {submittingQueue ? <Loading size="sm" /> : null}
        </Button>
      </Tooltip>

      <Tooltip tip={offlineTip} className="col-span-2 w-full 2xl:col-span-1">
        <Button
          variant="outline"
          className="w-full border-primary text-primary hover:bg-primary/10"
          type="button"
          onClick={() =>
            addCocktailToStatistic({
              workspaceId: workspaceId,
              cocktailId: cocktailId,
              cardId: cardId,
              actionSource: actionSource,
              notes: notes,
              setSubmitting: setSubmittingStatistic,
              onSuccess: () => onMarkedAsDone?.(),
              onNotDecidableError: (options) => {
                modalContext.openModal(
                  <SelectSpecifyCocktailForStatisticModal
                    workspaceId={workspaceId}
                    cocktailId={cocktailId}
                    cardId={cardId}
                    actionSource={actionSource}
                    cocktailName={cocktailName}
                    options={options}
                    onMarkedAsDone={onMarkedAsDone}
                  />,
                );
              },
            })
          }
          disabled={submittingStatistic || disabled?.markAsDone || isOffline}
        >
          <FaCheck />
          Gemacht
          {submittingStatistic ? <Loading size="sm" /> : null}
        </Button>
      </Tooltip>
    </div>
  );
}
