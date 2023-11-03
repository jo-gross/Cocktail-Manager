import { useContext } from 'react';
import { ModalContext } from '../../lib/context/ModalContextProvider';

interface DeleteConfirmationModalProps {
  onApprove: () => void;
  onCancel?: () => void;
  isDeleting?: boolean;
  spelling: 'DELETE' | 'REMOVE';
  entityName?: string;
}

export function DeleteConfirmationModal(props: DeleteConfirmationModalProps) {
  const modalContext = useContext(ModalContext);

  return (
    <div className="flex flex-col space-y-4">
      <div className="text-2xl font-bold">{props.spelling == 'DELETE' ? 'Löschen' : 'Entfernen'}</div>
      <div className="max-w-xl text-justify">{`Möchtest du ${props.entityName ?? 'diesen Eintrag'} wirklich ${
        props.spelling == 'DELETE' ? 'löschen' : 'entfernen'
      }?`}</div>
      <div className="flex flex-row space-x-4">
        <div className={'flex-1'}></div>
        <div
          className={`btn btn-outline ${props.isDeleting == true ? 'btn-disabled' : ''}`}
          onClick={() => {
            props.onCancel?.();
            modalContext.closeModal();
          }}
        >
          Abbrechen
        </div>
        <div
          className={`btn-red btn ${props.isDeleting == true ? 'loading' : ''}`}
          onClick={() => {
            props.onApprove();
            modalContext.closeModal();
          }}
        >
          {props.spelling == 'DELETE' ? 'Löschen' : 'Entfernen'}
        </div>
      </div>
    </div>
  );
}
