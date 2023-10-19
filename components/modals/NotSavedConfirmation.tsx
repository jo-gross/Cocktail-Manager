import { useContext } from 'react';
import { ModalContext } from '../../lib/context/ModalContextProvider';

interface NotSavedConfirmationProps {
  onSave: () => void;
  onNotSave?: () => void;
  onCancel?: () => void;
  isSaving?: boolean;
}

export function NotSavedConfirmation(props: NotSavedConfirmationProps) {
  const modalContext = useContext(ModalContext);

  return (
    <div className="flex flex-col space-y-4">
      <div className="text-2xl font-bold">Änderungen nicht gespeichert</div>
      <div className="text-justify max-w-xl">
        Du scheinst Änderungen gemacht zu haben, die noch nicht gespeichert wurden. Möchtest du ohne Speichern
        fortfahren?
      </div>
      <div className="flex flex-row space-x-4">
        <div className={'flex-1'}></div>
        <div
          className={`btn btn-outline`}
          onClick={() => {
            props.onCancel?.();
            modalContext.closeModal();
          }}
        >
          Abbrechen
        </div>
        <div
          className={`btn btn-outline`}
          onClick={() => {
            props.onNotSave?.();
            modalContext.closeModal();
          }}
        >
          Nicht speichern
        </div>
        <div
          className={`btn btn-primary ${props.isSaving == true ? 'loading' : ''}`}
          onClick={() => {
            props.onSave();
            modalContext.closeModal();
          }}
        >
          Speichern
        </div>
      </div>
    </div>
  );
}
