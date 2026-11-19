import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@components/ui';
import type { PlanErrorEvent } from '@lib/entitlements/planEvents';
import { ManageSubscriptionButton } from './ManageSubscriptionButton';

/** Translation key of a limit or feature; unknown keys are shown as they are. */
function keyLabel(t: (key: string, options?: Record<string, unknown>) => string, key: string): string {
  return t(`plan:limits.${key}`, { defaultValue: '' }) || t(`plan:features.${key}`, { defaultValue: key });
}

/**
 * Content of the dialog shown when the server refuses a request with 402: what was reached and, for `billing: portal`,
 * "Abo verwalten". `billing` is `null` when the plan is unknown (e.g. outside a workspace); then no button is shown.
 */
export function PlanLimitDialog({
  event,
  workspaceId,
  billing,
  onClose,
}: {
  event: PlanErrorEvent;
  workspaceId: string | null;
  billing: 'portal' | 'contact' | null;
  onClose: () => void;
}) {
  const { t } = useTranslation(['plan']);
  const key = event.details?.key ?? '';
  const label = keyLabel(t as never, key);

  let title: string;
  let text: string;
  switch (event.code) {
    case 'PLAN_LIMIT_REACHED':
      title = t('plan:dialog.limitTitle');
      text = t('plan:dialog.limitText', { limit: event.details?.limit ?? '–', key: label, current: event.details?.current ?? '–' });
      break;
    case 'PLAN_FEATURE_MISSING':
      title = t('plan:dialog.featureTitle');
      text = t('plan:dialog.featureText', { key: label });
      break;
    case 'WORKSPACE_READ_ONLY':
      title = t('plan:dialog.readOnlyTitle');
      text = t('plan:dialog.readOnlyText');
      break;
    case 'WORKSPACE_SUSPENDED':
      title = t('plan:dialog.suspendedTitle');
      text = t('plan:dialog.suspendedText');
      break;
  }

  return (
    <div className="flex flex-col gap-4" data-testid="plan-limit-dialog">
      <div className="text-2xl font-bold">{title}</div>
      <p className="max-w-xl">{text}</p>
      {billing === 'contact' ? <p className="max-w-xl text-sm text-base-content/70">{t('plan:billing.contact')}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          {t('plan:dialog.close')}
        </Button>
        {billing === 'portal' && workspaceId && event.code !== 'WORKSPACE_SUSPENDED' ? <ManageSubscriptionButton workspaceId={workspaceId} size="md" /> : null}
      </div>
    </div>
  );
}
