import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { FaArrowRight } from 'react-icons/fa6';
import { withPagePermission } from '@middleware/ui/withPagePermission';
import { SettingsLayout } from '@components/settings/SettingsLayout';
import { SettingsSection, SettingsSectionSkeleton } from '@components/settings/SettingsSection';
import { WorkspacePublicSlugSection } from '@components/settings/WorkspacePublicSlugSection';
import { settingsHref } from '@components/settings/settingsNavigation';

const linkClassName =
  'inline-flex h-9 min-h-9 items-center gap-1.5 rounded-lg border border-base-300 px-3 text-sm font-medium transition-colors hover:bg-base-200 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none';

function PublicSettingsPage() {
  const { t } = useTranslation(['settings', 'nav']);
  const router = useRouter();
  const workspaceId = typeof router.query.workspaceId === 'string' ? router.query.workspaceId : undefined;

  return (
    <SettingsLayout page="public">
      {workspaceId ? (
        <>
          <WorkspacePublicSlugSection workspaceId={workspaceId} />
          <SettingsSection
            title={t('nav:guestMenus')}
            description={t('settings:public.guestMenusHelp')}
            actions={
              <Link href={`/workspaces/${workspaceId}/manage/guest-menus`} className={linkClassName}>
                {t('settings:public.openGuestMenus')}
                <FaArrowRight aria-hidden />
              </Link>
            }
          >
            <p className="text-sm text-base-content/70">
              {t('settings:public.relatedSettings')}{' '}
              <Link className="link" href={settingsHref(workspaceId, 'general')}>
                {t('settings:pages.general.title')}
              </Link>
              {' · '}
              <Link className="link" href={settingsHref(workspaceId, 'languages')}>
                {t('settings:pages.languages.title')}
              </Link>
            </p>
          </SettingsSection>
        </>
      ) : (
        <SettingsSectionSkeleton rows={2} />
      )}
    </SettingsLayout>
  );
}

export default withPagePermission(['ADMIN'], PublicSettingsPage, '/workspaces/[workspaceId]/manage');
