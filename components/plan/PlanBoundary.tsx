import React, { useContext, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { Button, Card, CardBody } from '@components/ui';
import { PageCenter } from '@components/layout/PageCenter';
import { settingsHref } from '@components/settings/settingsNavigation';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { UserContext } from '@lib/context/UserContextProvider';
import { onPlanError } from '@lib/entitlements/planEvents';
import type { WorkspaceEntitlementDto } from '@lib/schemas/entitlements';
import { PlanProvider, usePlan } from './PlanContext';
import { ManageSubscriptionButton } from './ManageSubscriptionButton';
import { PlanLimitDialog } from './PlanLimitDialog';
import { PlanStatusBanner } from './PlanStatusBanner';

/** Pages a suspended workspace still opens: export (data) and leave/delete (danger). */
const SUSPENDED_PAGES = ['/workspaces/[workspaceId]/manage/settings/data', '/workspaces/[workspaceId]/manage/settings/danger'];

/** Status view instead of the page content while the workspace is suspended; paying stays possible (`billing: portal`). */
export function SuspendedWorkspaceView({ workspaceId, entitlement = null }: { workspaceId: string; entitlement?: WorkspaceEntitlementDto | null }) {
  const { t } = useTranslation(['plan']);
  return (
    <PageCenter>
      <Card className="max-w-lg" data-testid="plan-suspended-view">
        <CardBody className="flex flex-col gap-4">
          <h1 className="text-2xl font-bold">{t('plan:suspended.title')}</h1>
          <p>{t('plan:suspended.text')}</p>
          <div className="flex flex-wrap gap-2">
            <Link href={settingsHref(workspaceId, 'data')}>
              <Button variant="primary">{t('plan:suspended.export')}</Button>
            </Link>
            <Link href={settingsHref(workspaceId, 'danger')}>
              <Button variant="outline">{t('plan:suspended.leaveOrDelete')}</Button>
            </Link>
          </div>
          {entitlement?.plan?.billing === 'portal' ? (
            <div className="flex justify-end">
              <ManageSubscriptionButton workspaceId={workspaceId} available={entitlement.portalHandoff} size="md" />
            </div>
          ) : null}
        </CardBody>
      </Card>
    </PageCenter>
  );
}

function PlanGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const modalContext = useContext(ModalContext);
  const { workspaceId, entitlement, refresh } = usePlan();

  // Every 402 of a plan guard opens the dialog and reloads the plan (usage, status may have changed).
  useEffect(
    () =>
      onPlanError((event) => {
        refresh();
        const billing = entitlement?.plan?.billing ?? null;
        modalContext.openModal(
          <PlanLimitDialog
            event={event}
            workspaceId={workspaceId}
            billing={billing}
            portalHandoff={entitlement?.portalHandoff ?? false}
            onClose={() => modalContext.closeModal()}
          />,
        );
      }),
    [entitlement, modalContext, refresh, workspaceId],
  );

  if (!workspaceId || entitlement?.mode !== 'managed') return <>{children}</>;
  if (entitlement.plan?.status === 'SUSPENDED' && !SUSPENDED_PAGES.includes(router.pathname)) {
    return <SuspendedWorkspaceView workspaceId={workspaceId} entitlement={entitlement} />;
  }
  return (
    <>
      <PlanStatusBanner entitlement={entitlement} workspaceId={workspaceId} className="px-2 pt-2" />
      {children}
    </>
  );
}

/**
 * Plan UI of hosted instances (`ENTITLEMENTS_MODE=managed`): status banner, limit dialog and the status view of a
 * suspended workspace. With `ENTITLEMENTS_MODE=off` the plan endpoint answers `mode: 'off'` and this renders only its
 * children.
 */
export function PlanBoundary({ children }: { children: React.ReactNode }) {
  const userContext = useContext(UserContext);
  return (
    <PlanProvider workspaceId={userContext.workspace?.id ?? null}>
      <PlanGate>{children}</PlanGate>
    </PlanProvider>
  );
}
