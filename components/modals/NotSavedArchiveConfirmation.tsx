import { useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation(['entity', 'common', 'errors']);

  const [isSaving, setIsSaving] = useState(false);

  return (
    <div className="flex flex-col space-y-4">
      <div className="text-2xl font-bold">{t('entity:unsavedTitle')}</div>
      <div className="max-w-xl text-justify">{t('entity:unsavedMessage')}</div>
      <div className="flex flex-row space-x-4">
        <div className={'flex-1'}></div>
        <Button
          variant="outline"
          onClick={() => {
            props.onCancel?.();
            modalContext.closeModal();
          }}
        >
          {t('common:cancel')}
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
              alertService.error(t('errors:save'));
            } finally {
              setIsSaving(false);
            }
          }}
        >
          {isSaving || props.isArchiving ? <Loading size="sm" /> : null}
          {props.archive ? t('common:archive') : t('common:unarchive')}
        </Button>
      </div>
    </div>
  );
}
