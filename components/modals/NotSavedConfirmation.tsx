import { useContext, useState } from 'react';
import { ModalContext } from '../../lib/context/ModalContextProvider';
import { alertService } from '../../lib/alertService';

interface NotSavedConfirmationProps {
  onSave: () => Promise<void>;
  onNotSave?: () => void;
  onCancel?: () => void;
  isSaving?: boolean;
}

export function NotSavedConfirmation(props: NotSavedConfirmationProps) {
  const modalContext = useContext(ModalContext);

  const [isSaving, setIsSaving] = useState(false);

  return (
    <div className="flex flex-col space-y-4">
      <div className="text-2xl font-bold">Änderungen nicht gespeichert</div>
      <div className="max-w-xl text-justify">
        Du scheinst Änderungen gemacht zu haben, die noch nicht gespeichert wurden. Möchtest du ohne Speichern fortfahren?
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
        <button
          disabled={isSaving || props.isSaving}
          className={`btn btn-primary`}
          onClick={async () => {
            setIsSaving(true);
            try {
              await props.onSave();
              modalContext.closeModal();
            } catch (error) {
              console.error('NotSavedConfirmation -> onSave', error);
              alertService.error('Fehler beim Speichern');
            } finally {
              setIsSaving(false);
            }
          }}
        >
          {isSaving || props.isSaving ? <span className={'loading loading-spinner'} /> : <></>}
          Speichern
        </button>
      </div>
    </div>
  );
}
