import React, { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { Role } from '@generated/prisma/client';
import { Button } from '@components/ui';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { UserContext } from '@lib/context/UserContextProvider';
import { StartContentModal } from './StartContentModal';

/** "Add from templates" for empty lists (managers and above); opens the start content picker. */
export function AddFromTemplatesButton({ onApplied }: { onApplied?: () => void }) {
  const { t } = useTranslation(['onboarding']);
  const modalContext = useContext(ModalContext);
  const userContext = useContext(UserContext);
  const workspaceId = userContext.workspace?.id;
  if (!workspaceId || !userContext.isUserPermitted(Role.MANAGER)) return null;
  const locale = userContext.contentLocales?.primary ?? userContext.uiLocale;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => modalContext.openModal(<StartContentModal workspaceId={workspaceId} locale={locale} onApplied={onApplied} />)}
    >
      {t('onboarding:emptyState.addFromTemplates')}
    </Button>
  );
}
