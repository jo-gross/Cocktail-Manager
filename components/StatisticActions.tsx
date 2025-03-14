import { addCocktailToQueue, addCocktailToStatistic } from '../lib/network/cocktailTracking';
import { MdPlaylistAdd } from 'react-icons/md';
import { FaCheck } from 'react-icons/fa';
import React, { useContext, useState } from 'react';
import { ModalContext } from '../lib/context/ModalContextProvider';
import AddCocktailToQueueModal from './modals/AddCocktailToQueueModal';
import SelectSpecifyCocktailForStatisticModal from './modals/SelectSpecifyCocktailForStatisticModal';

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
  onAddToQueue,
  cocktailName,
}: StatisticActionsProps) {
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
        disabled={submittingQueue || disabled?.list}
      >
        <MdPlaylistAdd />
        Liste
        {submittingQueue ? <span className={'loading loading-spinner'}></span> : <></>}
      </button>

      <button
        className={'btn btn-outline flex-1'}
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
        disabled={submittingQueue || disabled?.listWithNote}
      >
        <MdPlaylistAdd />
        mit Notiz
        {submittingQueue ? <span className={'loading loading-spinner'}></span> : <></>}
      </button>
      <button
        className={'btn btn-outline btn-primary col-span-2 md:col-span-1'}
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
        disabled={submittingStatistic || disabled?.markAsDone}
      >
        <FaCheck />
        Gemacht
        {submittingStatistic ? <span className={'loading loading-spinner'}></span> : <></>}
      </button>
    </div>
  );
}
