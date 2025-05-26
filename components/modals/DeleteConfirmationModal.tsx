import { useContext, useState } from 'react';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { alertService } from '@lib/alertService';

interface DeleteConfirmationModalProps {
  onApprove: () => Promise<void>;
  onCancel?: () => void;
  spelling: 'DELETE' | 'REMOVE' | 'ABORT';
  entityName: string;
}

export function DeleteConfirmationModal(props: DeleteConfirmationModalProps) {
  const modalContext = useContext(ModalContext);

  const [isDeleting, setIsDeleting] = useState(false);

  return (
    <div className="flex flex-col space-y-4">
      <div className="text-2xl font-bold">{props.spelling == 'DELETE' ? 'Löschen' : props.spelling == 'REMOVE' ? 'Entfernen' : 'Abbrechen'}</div>
      <div className="max-w-xl text-justify">
        Möchtest du <span className={'font-bold italic'}>{props.entityName ?? 'diesen Eintrag'}</span> wirklich{' '}
        {props.spelling == 'DELETE' ? 'löschen' : props.spelling == 'REMOVE' ? 'entfernen' : 'abbrechen'}?
      </div>
      <div className="flex flex-row space-x-4">
        <div className={'flex-1'}></div>
        <button
          disabled={isDeleting}
          className={`btn btn-outline`}
          onClick={() => {
            props.onCancel?.();
            modalContext.closeModal();
          }}
        >
          Abbrechen
        </button>
        <button
          className={`btn-red btn`}
          onClick={async () => {
            setIsDeleting(true);
            try {
              await props.onApprove();
              modalContext.closeModal();
            } catch (error) {
              console.error('DeleteConfirmationModal -> onApprove', error);
              alertService.error('Fehler beim Löschen');
            } finally {
              setIsDeleting(false);
            }
          }}
        >
          {isDeleting ? <span className={'loading loading-spinner'} /> : <></>}
          {props.spelling == 'DELETE' ? 'Löschen' : props.spelling == 'REMOVE' ? 'Entfernen' : 'Abbruch bestätigen'}
        </button>
      </div>
    </div>
  );
}
