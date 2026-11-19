import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Loading, Tooltip } from '@components/ui';
import { SUBSCRIPTION_PORTAL_AVAILABLE, openSubscriptionPortal } from '@lib/entitlements/subscriptionPortal';

/**
 * "Abo verwalten" for `billing: portal`. The click goes through `openSubscriptionPortal` (integration point of the
 * portal handoff, task A3); until that exists the button is disabled with a hint.
 */
export function ManageSubscriptionButton({ workspaceId, size = 'sm' }: { workspaceId: string; size?: 'sm' | 'md' }) {
  const { t } = useTranslation(['plan']);
  const [busy, setBusy] = useState(false);

  const button = (
    <Button
      type="button"
      variant="primary"
      size={size}
      disabled={!SUBSCRIPTION_PORTAL_AVAILABLE || busy}
      onClick={async () => {
        setBusy(true);
        try {
          await openSubscriptionPortal(workspaceId);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Loading size="sm" /> : null}
      {t('plan:billing.manage')}
    </Button>
  );

  if (SUBSCRIPTION_PORTAL_AVAILABLE) return button;
  return <Tooltip tip={t('plan:billing.manageUnavailable')}>{button}</Tooltip>;
}
