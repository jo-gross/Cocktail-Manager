import { useContext, useState } from 'react';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { alertService } from '@lib/alertService';

interface Reference {
  id: string;
  name: string;
}

interface DeleteConfirmationModalProps {
  onApprove: () => Promise<void>;
  onCancel?: () => void;
  spelling: 'DELETE' | 'REMOVE' | 'ABORT';
  entityName: string;
  references?: Reference[];
  entityType?: 'ingredient' | 'glass';
}

export function DeleteConfirmationModal(props: DeleteConfirmationModalProps) {
  const modalContext = useContext(ModalContext);

  const [isDeleting, setIsDeleting] = useState(false);

  const hasReferences = props.references && props.references.length > 0;
  const entityTypeText = props.entityType === 'ingredient' ? 'Zutat' : props.entityType === 'glass' ? 'Glas' : 'Eintrag';

  return (
    <div className="flex flex-col space-y-4">
      <div className="text-2xl font-bold">{props.spelling == 'DELETE' ? 'Löschen' : props.spelling == 'REMOVE' ? 'Entfernen' : 'Abbrechen'}</div>
      <div className="max-w-xl text-justify">
        {hasReferences ? (
          <div className="flex flex-col space-y-4">
            <div className="font-bold text-error">
              Diese {entityTypeText} kann nicht gelöscht werden, da sie noch in {props.references!.length} Cocktail(s) verwendet wird!
            </div>
            <div className="flex flex-col space-y-2">
              <div className="font-bold">Verwendet in folgenden Cocktails:</div>
              <div className="max-h-64 overflow-y-auto rounded border border-base-300 p-2">
                <ul className="list-inside list-disc space-y-1">
                  {props.references!.map((cocktail) => (
                    <li key={cocktail.id}>{cocktail.name}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <div>
            Möchtest du <span className={'font-bold italic'}>{props.entityName ?? 'diesen Eintrag'}</span> wirklich{' '}
            {props.spelling == 'DELETE' ? 'löschen' : props.spelling == 'REMOVE' ? 'entfernen' : 'abbrechen'}?
          </div>
        )}
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
          {hasReferences ? 'Schließen' : 'Abbrechen'}
        </button>
        {!hasReferences && (
          <button
            disabled={isDeleting}
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
        )}
      </div>
    </div>
  );
}
