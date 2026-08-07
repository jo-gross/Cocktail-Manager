import { addCocktailToStatistic } from '@lib/network/cocktailTracking';
import { FaCheck } from 'react-icons/fa';
import React, { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { Button, Loading } from '@components/ui';

interface SelectSpecifyCocktailForStatisticModalProps {
  workspaceId: string;
  cocktailId: string;
  cardId?: string;
  cocktailName: string;
  actionSource: 'SEARCH_MODAL' | 'CARD' | 'DETAIL_MODAL' | 'QUEUE';
  onMarkedAsDone?: () => void;
  options: { _min: { id: string }; notes: string }[];
}

export default function SelectSpecifyCocktailForStatisticModal({
  workspaceId,
  cocktailId,
  cardId,
  cocktailName,
  options,
  actionSource,
  onMarkedAsDone,
}: SelectSpecifyCocktailForStatisticModalProps) {
  const modalContext = useContext(ModalContext);
  const { t } = useTranslation(['cocktail']);
  const [submittingStatistic, setSubmittingStatistic] = React.useState<{ [key: string]: boolean }>({});

  return (
    <div className={'pt-2'}>
      <div className={'text-2xl font-bold'}>{t('cocktail:queueModalTitle', { name: cocktailName })}</div>
      <div className={'text-sm font-thin italic'}>{t('cocktail:queueNotesHint')}</div>
      <div className={'flex flex-col divide-y pt-2'}>
        {options.map((option) => (
          <div key={option._min.id} className={'flex flex-row items-center justify-between p-2'}>
            <div className={'flex flex-col gap-1'}>
              {option.notes ? (
                <>
                  <div>{t('cocktail:noteLabel')}</div>
                  <div className={'italic'}>{option.notes ?? t('cocktail:withoutNote')}</div>
                </>
              ) : (
                <div>{t('cocktail:normalWithoutNote')}</div>
              )}
            </div>
            <Button
              variant="outline"
              disabled={Object.keys(submittingStatistic).length > 0}
              onClick={() => {
                addCocktailToStatistic({
                  workspaceId: workspaceId,
                  cocktailId: cocktailId,
                  cardId: cardId,
                  actionSource: actionSource,
                  notes: option.notes ?? '-',
                  setSubmitting: () => {
                    setSubmittingStatistic({ [`option-${option._min.id}`]: true });
                  },
                  onSuccess: () => {
                    modalContext.closeModal();
                    onMarkedAsDone?.();
                  },
                });
              }}
            >
              <FaCheck />
              {t('cocktail:markedDone')}
              {submittingStatistic[`option-${option._min.id}`] ? <Loading size="sm" /> : null}
            </Button>
          </div>
        ))}

        <div className={'flex flex-row items-center justify-between p-2'}>
          {t('cocktail:withoutAffectingQueue')}
          <Button
            variant="outline"
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
                onSuccess: () => {
                  modalContext.closeModal();
                  onMarkedAsDone?.();
                },
              });
            }}
          >
            <FaCheck />
            {t('cocktail:markedDone')}
            {submittingStatistic['normal'] ? <Loading size="sm" /> : null}
          </Button>
        </div>
      </div>
    </div>
  );
}
