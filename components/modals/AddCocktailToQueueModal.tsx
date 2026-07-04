import { addCocktailToQueue } from '@lib/network/cocktailTracking';
import { MdPlaylistAdd } from 'react-icons/md';
import React, { useContext, useState } from 'react';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { FaMinus, FaPlus } from 'react-icons/fa';
import { Button, ButtonGroup, Loading, Textarea } from '@components/ui';

interface AddCocktailToQueueModalProps {
  workspaceId: string;
  cocktailId: string;
  cocktailName: string;
  initComment?: string;
  actionSource: 'SEARCH_MODAL' | 'CARD' | 'DETAIL_MODAL' | 'QUEUE';
}

export default function AddCocktailToQueueModal({
  workspaceId,
  cocktailId,
  actionSource: _actionSource,
  cocktailName,
  initComment,
}: AddCocktailToQueueModalProps) {
  const [submittingQueue, setSubmittingQueue] = useState(false);

  const [notes, setNotes] = useState(initComment ?? '');
  const [amount, setAmount] = useState(1);

  const modalContext = useContext(ModalContext);
  return (
    <div className={'space-y-2 pt-4'}>
      <div className={'text-2xl font-bold'}>
        <strong>{cocktailName}</strong> hinzufügen
      </div>
      <div className={'flex'}>
        <ButtonGroup>
          <div className="join-item flex flex-1 items-center gap-2 rounded-none border border-base-content/20 bg-base-100 px-3">
            <strong>Anzahl</strong>
            <input
              type="number"
              className={'grow bg-transparent outline-none'}
              value={amount}
              min={1}
              onChange={(e) => {
                setAmount(parseInt(e.target.value));
              }}
            />
          </div>
          <Button
            joinItem
            variant="outline"
            onClick={() => {
              setAmount(amount + 1);
            }}
          >
            <FaPlus />
          </Button>
          <Button
            joinItem
            variant="outline"
            disabled={amount <= 1}
            onClick={() => {
              if (amount > 1) {
                setAmount(amount - 1);
              }
            }}
          >
            <FaMinus />
          </Button>
        </ButtonGroup>
      </div>
      <Textarea className="w-full" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={'Notiz'} />
      <Button
        variant="outline"
        className="w-full flex-1"
        onClick={() =>
          addCocktailToQueue({
            workspaceId: workspaceId,
            cocktailId: cocktailId,
            notes: notes,
            amount: amount,
            setSubmitting: setSubmittingQueue,
            onSuccess: () => {
              modalContext.closeModal();
              setNotes('');
            },
          })
        }
        disabled={submittingQueue}
      >
        <MdPlaylistAdd />
        Hinzufügen
        {submittingQueue ? <Loading size="sm" /> : null}
      </Button>
    </div>
  );
}
