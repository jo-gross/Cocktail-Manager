import React, { useContext } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { FaInfoCircle } from 'react-icons/fa';
import { LuWandSparkles } from 'react-icons/lu';
import { Role } from '@generated/prisma/client';
import { Button, Card, CardBody, cn } from '@components/ui';
import { UserContext } from '@lib/context/UserContextProvider';
import { shouldShowSetupBanner } from '@lib/onboarding/setupWizard';

/**
 * Non-blocking banners of the current workspace: "continue setup" for admins while the setup wizard
 * is open, and the template notice for workspaces that serve as template for new workspaces.
 */
export function WorkspaceStatusBanner({ className }: { className?: string }) {
  const { t } = useTranslation(['onboarding']);
  const userContext = useContext(UserContext);
  const workspace = userContext.workspace;
  if (!workspace) return null;

  if (workspace.isTemplate) {
    return (
      <div className={cn('print:hidden', className)}>
        <div role="status" className="flex items-start gap-3 rounded-lg border border-info/40 bg-info/10 px-4 py-3 text-sm">
          <FaInfoCircle aria-hidden className="mt-0.5 shrink-0 text-info" />
          <span>{t('onboarding:banner.template')}</span>
        </div>
      </div>
    );
  }

  if (!shouldShowSetupBanner(workspace, userContext.isUserPermitted(Role.ADMIN))) return null;

  return (
    <div className={cn('print:hidden', className)}>
      <Card>
        <CardBody compact className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <LuWandSparkles aria-hidden className="mt-1 shrink-0 text-xl text-primary" />
            <div className="flex flex-col gap-1">
              <h2 className="font-bold">{t('onboarding:banner.setupTitle')}</h2>
              <p className="text-sm text-base-content/70">{t('onboarding:banner.setupBody')}</p>
            </div>
          </div>
          <Link href={`/workspaces/${workspace.id}/setup`} className="shrink-0">
            <Button variant="primary" size="sm">
              {t('onboarding:banner.setupAction')}
            </Button>
          </Link>
        </CardBody>
      </Card>
    </div>
  );
}

/** Whether {@link WorkspaceStatusBanner} shows the setup banner (other offers step back meanwhile). */
export function useSetupBannerVisible(): boolean {
  const userContext = useContext(UserContext);
  return shouldShowSetupBanner(userContext.workspace, userContext.isUserPermitted(Role.ADMIN));
}
