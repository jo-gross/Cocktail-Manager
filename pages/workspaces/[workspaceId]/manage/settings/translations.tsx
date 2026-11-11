import React from 'react';
import { useRouter } from 'next/router';
import { SettingsLayout } from '@components/settings/SettingsLayout';
import { SettingsSectionSkeleton } from '@components/settings/SettingsSection';
import { ContentTranslationCenter } from '@components/settings/ContentTranslationCenter';
import { NextPageWithPullToRefresh } from '../../../../../types/next';

const refreshRef: React.MutableRefObject<(() => void) | undefined> = { current: undefined };

/** Content translation center (all members can read, managers can edit). */
const TranslationSettingsPage: NextPageWithPullToRefresh = () => {
  const router = useRouter();
  const workspaceId = typeof router.query.workspaceId === 'string' ? router.query.workspaceId : undefined;

  return (
    <SettingsLayout page="translations" wide>
      {workspaceId ? <ContentTranslationCenter workspaceId={workspaceId} refreshRef={refreshRef} /> : <SettingsSectionSkeleton rows={6} />}
    </SettingsLayout>
  );
};

TranslationSettingsPage.pullToRefresh = () => refreshRef.current?.();

export default TranslationSettingsPage;
