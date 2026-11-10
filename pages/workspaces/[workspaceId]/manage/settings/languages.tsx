import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { FaArrowRight } from 'react-icons/fa6';
import { withPagePermission } from '@middleware/ui/withPagePermission';
import { SettingsLayout } from '@components/settings/SettingsLayout';
import { SettingsSection, SettingsSectionSkeleton } from '@components/settings/SettingsSection';
import { ContentLanguagesSection } from '@components/settings/ContentLanguagesSection';
import { EntityLabelTranslationsSection } from '@components/settings/EntityLabelTranslationsSection';
import { settingsHref } from '@components/settings/settingsNavigation';

function LanguageSettingsPage() {
  const { t } = useTranslation(['settings']);
  const router = useRouter();
  const workspaceId = typeof router.query.workspaceId === 'string' ? router.query.workspaceId : undefined;
  const [labelsDirty, setLabelsDirty] = useState(false);

  return (
    <SettingsLayout page="languages" unsavedChanges={labelsDirty}>
      {workspaceId ? (
        <>
          <ContentLanguagesSection workspaceId={workspaceId} />
          <SettingsSection
            title={t('settings:languages.centerTitle')}
            description={t('settings:languages.centerHelp')}
            actions={
              <Link
                href={settingsHref(workspaceId, 'translations')}
                className="inline-flex h-9 min-h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-content transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                {t('settings:languages.openCenter')}
                <FaArrowRight aria-hidden />
              </Link>
            }
          />
          <EntityLabelTranslationsSection workspaceId={workspaceId} onDirtyChange={setLabelsDirty} />
        </>
      ) : (
        <>
          <SettingsSectionSkeleton rows={2} />
          <SettingsSectionSkeleton rows={4} />
        </>
      )}
    </SettingsLayout>
  );
}

export default withPagePermission(['ADMIN'], LanguageSettingsPage, '/workspaces/[workspaceId]/manage');
