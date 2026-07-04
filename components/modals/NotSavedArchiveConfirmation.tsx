import { useContext, useState } from 'react';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { alertService } from '@lib/alertService';
import { Button, Loading } from '@components/ui';

interface NotSavedConfirmationProps {
  onArchive: () => void;
  onCancel?: () => void;
  isArchiving?: boolean;
  archive?: boolean;
}

export function NotSavedArchiveConfirmation(props: NotSavedConfirmationProps) {
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
        <Button
          variant="outline"
          onClick={() => {
            props.onCancel?.();
            modalContext.closeModal();
          }}
        >
          Abbrechen
        </Button>
        <Button
          disabled={isSaving || props.isArchiving}
          variant="primary"
          onClick={async () => {
            setIsSaving(true);
            try {
              await props.onArchive();
              modalContext.closeModal();
            } catch (error) {
              console.error('NotSavedConfirmation -> onSave', error);
              alertService.error('Fehler beim Speichern');
            } finally {
              setIsSaving(false);
            }
          }}
        >
          {isSaving || props.isArchiving ? <Loading size="sm" /> : null}
          {props.archive ? 'Archivieren' : 'Entarchivieren'}
        </Button>
      </div>
    </div>
  );
}
