import React, { useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@components/ui';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { StartContentPanel, type AppliedTemplate } from './StartContentPanel';

interface StartContentModalProps {
  workspaceId: string;
  locale: string;
  /** Called after each applied template (e.g. reload the list behind the modal). */
  onApplied?: () => void;
}

/** The start content picker of the setup wizard as a modal (help page, empty lists). */
export function StartContentModal({ workspaceId, locale, onApplied }: StartContentModalProps) {
  const { t } = useTranslation(['onboarding', 'common']);
  const modalContext = useContext(ModalContext);
  const [applied, setApplied] = useState<AppliedTemplate[]>([]);

  return (
    <div className="flex w-[min(56rem,calc(100vw-4rem))] flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold">{t('onboarding:content.modalTitle')}</h2>
        <p className="text-sm text-base-content/70">{t('onboarding:content.modalHelp')}</p>
      </div>
      <StartContentPanel
        workspaceId={workspaceId}
        locale={locale}
        applied={applied}
        onApplied={(entry) => {
          setApplied((previous) => [...previous, entry]);
          onApplied?.();
        }}
      />
      <div className="flex justify-end">
        <Button type="button" variant="primary" onClick={() => modalContext.closeModal()}>
          {t('common:close')}
        </Button>
      </div>
    </div>
  );
}
