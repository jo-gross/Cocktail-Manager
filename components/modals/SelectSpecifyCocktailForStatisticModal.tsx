import { addCocktailToStatistic } from '../../lib/network/cocktailTracking';
import { FaCheck } from 'react-icons/fa';
import React, { useContext } from 'react';
import { ModalContext } from '../../lib/context/ModalContextProvider';

interface SelectSpecifyCocktailForStatisticModalProps {
  workspaceId: string;
  cocktailId: string;
  cardId?: string;
  cocktailName: string;
  actionSource: 'SEARCH_MODAL' | 'CARD' | 'DETAIL_MODAL' | 'QUEUE';
  options: { _min: { id: string }; notes: string }[];
}

export default function SelectSpecifyCocktailForStatisticModal({
  workspaceId,
  cocktailId,
  cardId,
  cocktailName,
  options,
  actionSource,
}: SelectSpecifyCocktailForStatisticModalProps) {
  const modalContext = useContext(ModalContext);
  const [submittingStatistic, setSubmittingStatistic] = React.useState<{ [key: string]: boolean }>({});

  return (
    <div className={'pt-2'}>
      <div className={'text-2xl font-bold'}>Warteschlange - {cocktailName}</div>
      <div className={'text-sm font-thin italic'}>In der Warteschlange befinden sich Einträge mit Notizen, war es einer davon?</div>
      <div className={'flex flex-col divide-y pt-2'}>
        {options.map((option) => (
          <div key={option._min.id} className={'flex flex-row items-center justify-between p-2'}>
            <div className={'flex flex-col gap-1'}>
              <div>Notiz:</div>
              <div className={'italic'}>{option.notes}</div>
            </div>
            <button
              className={'btn btn-outline btn-primary'}
              disabled={Object.keys(submittingStatistic).length > 0}
              onClick={() => {
                addCocktailToStatistic({
                  workspaceId: workspaceId,
                  cocktailId: cocktailId,
                  cardId: cardId,
                  actionSource: actionSource,
                  notes: option.notes,
                  setSubmitting: () => {
                    setSubmittingStatistic({ [`option-${option._min.id}`]: true });
                  },
                  onSuccess: () => modalContext.closeModal(),
                });
              }}
            >
              <FaCheck />
              Gemacht
              {submittingStatistic[`option-${option._min.id}`] ? <span className={'loading loading-spinner'}></span> : <></>}
            </button>
          </div>
        ))}

        <div className={'flex flex-row items-center justify-between p-2'}>
          Keiner davon, normale Variante.
          <button
            className={'btn btn-outline btn-primary'}
            disabled={Object.keys(submittingStatistic).length > 0}
            onClick={() => {
              addCocktailToStatistic({
                workspaceId: workspaceId,
                cocktailId: cocktailId,
                cardId: cardId,
                actionSource: actionSource,
                ignoreQueue: true,
                setSubmitting: () => {
                  setSubmittingStatistic({ normal: true });
                },
                onSuccess: () => modalContext.closeModal(),
              });
            }}
          >
            <FaCheck />
            Gemacht
            {submittingStatistic['normal'] ? <span className={'loading loading-spinner'}></span> : <></>}
          </button>
        </div>
      </div>
    </div>
  );
}
