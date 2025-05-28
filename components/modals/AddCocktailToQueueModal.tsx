import { addCocktailToQueue } from '@lib/network/cocktailTracking';
import { MdPlaylistAdd } from 'react-icons/md';
import React, { useContext, useState } from 'react';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { FaMinus, FaPlus } from 'react-icons/fa';

interface AddCocktailToQueueModalProps {
  workspaceId: string;
  cocktailId: string;
  cocktailName: string;
  initComment?: string;
  actionSource: 'SEARCH_MODAL' | 'CARD' | 'DETAIL_MODAL' | 'QUEUE';
}

export default function AddCocktailToQueueModal({ workspaceId, cocktailId, actionSource, cocktailName, initComment }: AddCocktailToQueueModalProps) {
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
        <div className={'join'}>
          <label className="input join-item flex flex-1 items-center gap-2">
            <strong>Anzahl</strong>
            <input
              type="number"
              className={'grow'}
              value={amount}
              min={1}
              onChange={(e) => {
                setAmount(parseInt(e.target.value));
              }}
            />
          </label>
          <button
            className={'btn btn-outline btn-primary join-item'}
            onClick={() => {
              setAmount(amount + 1);
            }}
          >
            <FaPlus />
          </button>
          <button
            className={'btn btn-outline btn-secondary join-item'}
            disabled={amount <= 1}
            onClick={() => {
              if (amount > 1) {
                setAmount(amount - 1);
              }
            }}
          >
            <FaMinus />
          </button>
        </div>
      </div>
      <textarea className={'textarea w-full'} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={'Notiz'}></textarea>
      <button
        className={'btn btn-outline btn-primary w-full flex-1'}
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
        {submittingQueue ? <span className={'loading loading-spinner'}></span> : <></>}
      </button>
    </div>
  );
}
