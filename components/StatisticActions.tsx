import { addCocktailToQueue, addCocktailToStatistic } from '../lib/network/cocktailTracking';
import { MdPlaylistAdd } from 'react-icons/md';
import { FaCheck } from 'react-icons/fa';
import React, { useContext, useState } from 'react';
import { ModalContext } from '../lib/context/ModalContextProvider';
import AddCocktailToQueueModal from './modals/AddCocktailToQueueModal';

interface StatisticActionsProps {
  workspaceId: string;
  cocktailId: string;

  cardId?: string;
  actionSource: 'SEARCH_MODAL' | 'CARD' | 'DETAIL_MODAL' | 'QUEUE';
  notes?: string;

  onAddToQueue?: () => void;
  onMarkedAsDone?: () => void;
}

export default function StatisticActions({ workspaceId, cocktailId, cardId, actionSource, notes, onMarkedAsDone, onAddToQueue }: StatisticActionsProps) {
  const [submittingQueue, setSubmittingQueue] = useState(false);
  const [submittingStatistic, setSubmittingStatistic] = useState(false);

  const modalContext = useContext(ModalContext);

  return (
    <div className={'grid grid-cols-2 gap-2 md:grid-cols-3'}>
      <button
        className={'btn btn-outline flex-1'}
        onClick={() =>
          addCocktailToQueue({
            workspaceId: workspaceId,
            cocktailId: cocktailId,
            setSubmitting: setSubmittingQueue,
          })
        }
        disabled={submittingQueue}
      >
        <MdPlaylistAdd />
        Liste
        {submittingQueue ? <span className={'loading loading-spinner'}></span> : <></>}
      </button>

      <button
        className={'btn btn-outline flex-1'}
        onClick={() => modalContext.openModal(<AddCocktailToQueueModal workspaceId={workspaceId} cocktailId={cocktailId} actionSource={actionSource} />)}
        disabled={submittingQueue}
      >
        <MdPlaylistAdd />
        mit Notiz
        {submittingQueue ? <span className={'loading loading-spinner'}></span> : <></>}
      </button>
      <button
        className={'col-span-auto btn btn-outline btn-primary'}
        onClick={() =>
          addCocktailToStatistic({
            workspaceId: workspaceId,
            cocktailId: cocktailId,
            cardId: cardId,
            actionSource: actionSource,
            notes: notes,
            setSubmitting: setSubmittingStatistic,
            onSuccess: () => onMarkedAsDone?.(),
          })
        }
        disabled={submittingStatistic}
      >
        <FaCheck />
        Gemacht
        {submittingStatistic ? <span className={'loading loading-spinner'}></span> : <></>}
      </button>
    </div>
  );
}
