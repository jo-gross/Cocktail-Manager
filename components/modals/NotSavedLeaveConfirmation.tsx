import { useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { alertService } from '@lib/alertService';
import { Button, Loading } from '@components/ui';

interface NotSavedConfirmationProps {
  onSave: () => Promise<void>;
  onNotSave?: () => void;
  onCancel?: () => void;
  isSaving?: boolean;
}

export function NotSavedLeaveConfirmation(props: NotSavedConfirmationProps) {
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
          variant="outline"
          onClick={() => {
            props.onNotSave?.();
            modalContext.closeModal();
          }}
        >
          {t('common:doNotSave')}
        </Button>
        <Button
          disabled={isSaving || props.isSaving}
          variant="primary"
          onClick={async () => {
            setIsSaving(true);
            try {
              await props.onSave();
              modalContext.closeModal();
            } catch (error) {
              console.error('NotSavedConfirmation -> onSave', error);
              alertService.error(t('errors:save'));
            } finally {
              setIsSaving(false);
            }
          }}
        >
          {isSaving || props.isSaving ? <Loading size="sm" /> : null}
          {t('common:save')}
        </Button>
      </div>
    </div>
  );
}
