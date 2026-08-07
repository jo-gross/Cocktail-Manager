import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { Button } from '@components/ui';

interface FormValidationWarningProps {
  warnings: string[];
  onContinue?: () => void;
  onCancel?: () => void;
}

export function FormValidationWarningModal(props: FormValidationWarningProps) {
  const modalContext = useContext(ModalContext);
  const { t } = useTranslation(['entity', 'common']);

  return (
    <div className="flex flex-col space-y-4">
      <div className="text-2xl font-bold">{t('entity:validationWarningTitle')}</div>
      <div className="max-w-xl text-justify">
        <div className="mb-2">{t('entity:validationWarningIntro')}</div>
        <ul className="list-inside list-disc space-y-1">
          {props.warnings.map((warning, index) => (
            <li key={index} className="text-warning">
              {warning}
            </li>
          ))}
        </ul>
        <div className="mt-4">{t('entity:validationWarningContinue')}</div>
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
          {t('common:cancel')}
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            props.onContinue?.();
            modalContext.closeModal();
          }}
        >
          {t('common:saveAnyway')}
        </Button>
      </div>
    </div>
  );
}
