import React from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, cn } from '@components/ui';
import type { WorkspaceEntitlementDto } from '@lib/schemas/entitlements';
import { ManageSubscriptionButton } from './ManageSubscriptionButton';

/**
 * Status banner of the workspace plan: `GRACE` (warning), `READ_ONLY` and `SUSPENDED` (error). Nothing for `ACTIVE`,
 * without a plan or with `ENTITLEMENTS_MODE=off`. Its own component, so other banners (announcements) can stack.
 */
export function PlanStatusBanner({
  entitlement,
  workspaceId,
  className,
}: {
  entitlement: WorkspaceEntitlementDto | null;
  workspaceId: string;
  className?: string;
}) {
  const { t } = useTranslation(['plan']);
  const plan = entitlement?.mode === 'managed' ? entitlement.plan : null;
  if (!plan || plan.status === 'ACTIVE') return null;

  return (
    <div className={cn('print:hidden', className)} data-testid="plan-status-banner">
      <Alert variant={plan.status === 'GRACE' ? 'warning' : 'error'} className="items-center justify-between">
        <span>{t(`plan:banner.${plan.status}`)}</span>
        {plan.billing === 'portal' ? <ManageSubscriptionButton workspaceId={workspaceId} available={entitlement?.portalHandoff ?? false} /> : null}
      </Alert>
    </div>
  );
}
