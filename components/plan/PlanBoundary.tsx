import React, { useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { Role } from '@generated/prisma/client';
import { Button, Card, CardBody, Loading } from '@components/ui';
import { PageCenter } from '@components/layout/PageCenter';
import { settingsHref } from '@components/settings/settingsNavigation';
import { alertService } from '@lib/alertService';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { UserContext } from '@lib/context/UserContextProvider';
import { onPlanError } from '@lib/entitlements/planEvents';
import { alertApiV1Error, apiV1Mutate, getApiV1ErrorMessage } from '@lib/network/apiV1';
import type { WorkspaceEntitlementDto } from '@lib/schemas/entitlements';
import { PlanProvider, usePlan } from './PlanContext';
import { ManageSubscriptionButton } from './ManageSubscriptionButton';
import { PlanLimitDialog } from './PlanLimitDialog';
import { PlanStatusBanner } from './PlanStatusBanner';

/** Pages a suspended workspace still opens: export (data) and leave/delete (danger). */
const SUSPENDED_PAGES = ['/workspaces/[workspaceId]/manage/settings/data', '/workspaces/[workspaceId]/manage/settings/danger'];

/**
 * Exports every member may run today (role `USER`, `COCKTAILS_READ`/`CALCULATIONS_READ`), with `all: true` because the
 * lists are not readable in a suspended workspace. The cocktail export includes the glasses, garnishes and ingredients
 * of the cocktails. Admins also reach the full backup on the settings page *Data*.
 */
const MEMBER_EXPORTS = [
  { id: 'cocktails', path: 'cocktails/export/json', body: { all: true }, file: 'cocktails-export' },
  { id: 'calculations', path: 'calculations/export/json', body: { all: true }, file: 'calculations-export' },
] as const;

type MemberExport = (typeof MEMBER_EXPORTS)[number];

/** Status view instead of the page content while the workspace is suspended; paying stays possible (`billing: portal`). */
export function SuspendedWorkspaceView({ workspaceId, entitlement = null }: { workspaceId: string; entitlement?: WorkspaceEntitlementDto | null }) {
  const { t } = useTranslation(['plan', 'common', 'errors']);
  const router = useRouter();
  const userContext = useContext(UserContext);
  const [busy, setBusy] = useState<MemberExport['id'] | 'leave' | null>(null);

  const isAdmin = userContext.isUserPermitted(Role.ADMIN);
  const members = userContext.workspace?.members ?? [];
  const me = members.find((member) => member.userId === userContext.user?.id);
  // Same rules as the users page and `POST …/leave`: the last owner cannot leave; the identity provider manages
  // memberships of externally managed workspaces.
  const isLastOwner = me?.role === Role.OWNER && members.filter((member) => member.role === Role.OWNER).length <= 1;
  const canLeave = !isLastOwner && !userContext.workspace?.isExternallyManaged;

  const runExport = async (entry: MemberExport) => {
    setBusy(entry.id);
    try {
      const response = await fetch(`/api/v1/workspaces/${workspaceId}/${entry.path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry.body),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        alertService.error(getApiV1ErrorMessage(body, t('errors:export')), response.status, response.statusText);
        return;
      }
      const url = window.URL.createObjectURL(new Blob([JSON.stringify(body, null, 2)], { type: 'application/json' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${entry.file}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('SuspendedWorkspaceView -> export', error);
      alertService.error(t('errors:export'));
    } finally {
      setBusy(null);
    }
  };

  const leave = async () => {
    setBusy('leave');
    try {
      await apiV1Mutate(`/api/v1/workspaces/${workspaceId}/leave`, 'POST');
      await router.replace('/');
      alertService.success(t('common:success.left'));
    } catch (error) {
      alertApiV1Error(error, t('errors:leaveWorkspace'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <PageCenter>
      <Card className="max-w-lg" data-testid="plan-suspended-view">
        <CardBody className="flex flex-col gap-4">
          <h1 className="text-2xl font-bold">{t('plan:suspended.title')}</h1>
          <p>{t('plan:suspended.text')}</p>
          <div className="flex flex-wrap gap-2">
            {MEMBER_EXPORTS.map((entry) => (
              <Button key={entry.id} type="button" variant="primary" disabled={busy !== null} onClick={() => void runExport(entry)}>
                {busy === entry.id ? <Loading size="sm" /> : null}
                {t(`plan:suspended.exports.${entry.id}`)}
              </Button>
            ))}
            {isAdmin ? (
              <Link href={settingsHref(workspaceId, 'data')}>
                <Button variant="outline">{t('plan:suspended.export')}</Button>
              </Link>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {canLeave ? (
              <Button type="button" variant="error" disabled={busy !== null} onClick={() => void leave()}>
                {busy === 'leave' ? <Loading size="sm" /> : null}
                {t('plan:suspended.leave')}
              </Button>
            ) : null}
            {isAdmin ? (
              <Link href={settingsHref(workspaceId, 'danger')}>
                <Button variant="outline">{t('plan:suspended.leaveOrDelete')}</Button>
              </Link>
            ) : null}
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

  // Every 402 of a plan guard reloads the plan (usage, status may have changed) and opens the dialog. Reads refused
  // because the workspace is suspended (the page and the app shell load in the background) only reload the plan: the
  // status view explains it, a dialog on top of it would not.
  useEffect(
    () =>
      onPlanError((event) => {
        refresh();
        if (event.read && event.code === 'WORKSPACE_SUSPENDED') return;
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

  const managed = workspaceId !== null && entitlement?.mode === 'managed';
  const suspended = managed && entitlement.plan?.status === 'SUSPENDED' && !SUSPENDED_PAGES.includes(router.pathname);
  // One tree for every state (banner slot, page slot), so the page is not remounted when the plan loads or the
  // workspace changes; only the status view of a suspended workspace replaces it.
  return (
    <>
      {managed && !suspended ? <PlanStatusBanner entitlement={entitlement} workspaceId={workspaceId} className="px-2 pt-2" /> : null}
      {suspended ? <SuspendedWorkspaceView workspaceId={workspaceId} entitlement={entitlement} /> : children}
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
