import { useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { alertService } from '@lib/alertService';
import { Button, Loading } from '@components/ui';

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
  const { t } = useTranslation(['entity', 'errors']);

  const [isDeleting, setIsDeleting] = useState(false);

  const hasReferences = props.references && props.references.length > 0;
  const entityTypeText =
    props.entityType === 'ingredient' ? t('entity:type.ingredient') : props.entityType === 'glass' ? t('entity:type.glass') : t('entity:type.entry');

  const title = props.spelling == 'DELETE' ? t('entity:delete') : props.spelling == 'REMOVE' ? t('entity:remove') : t('entity:abort');
  const actionVerb = props.spelling == 'DELETE' ? t('entity:action.delete') : props.spelling == 'REMOVE' ? t('entity:action.remove') : t('entity:action.abort');
  const confirmLabel = props.spelling == 'DELETE' ? t('entity:delete') : props.spelling == 'REMOVE' ? t('entity:remove') : t('entity:confirmAbort');

  return (
    <div className="flex flex-col space-y-4">
      <div className="text-2xl font-bold">{title}</div>
      <div className="max-w-xl text-justify">
        {hasReferences ? (
          <div className="flex flex-col space-y-4">
            <div className="font-bold text-error">{t('entity:hasReferences', { type: entityTypeText, count: props.references!.length })}</div>
            <div className="flex flex-col space-y-2">
              <div className="font-bold">{t('entity:usedInCocktails')}</div>
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
            {t('entity:confirmQuestion', {
              name: props.entityName || t('entity:thisEntry'),
              action: actionVerb,
            })}
          </div>
        )}
      </div>
      <div className="flex flex-row space-x-4">
        <div className={'flex-1'}></div>
        <Button
          disabled={isDeleting}
          variant="outline"
          onClick={() => {
            props.onCancel?.();
            modalContext.closeModal();
          }}
        >
          {hasReferences ? t('entity:close') : t('entity:abort')}
        </Button>
        {!hasReferences && (
          <Button
            disabled={isDeleting}
            variant="error"
            onClick={async () => {
              setIsDeleting(true);
              try {
                await props.onApprove();
                modalContext.closeModal();
              } catch (error) {
                console.error('DeleteConfirmationModal -> onApprove', error);
                alertService.error(t('errors:delete'));
              } finally {
                setIsDeleting(false);
              }
            }}
          >
            {isDeleting ? <Loading size="sm" /> : null}
            {confirmLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
