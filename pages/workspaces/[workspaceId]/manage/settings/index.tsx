import React from 'react';
import { useRouter } from 'next/router';
import { withPagePermission } from '@middleware/ui/withPagePermission';
import { SettingsLayout } from '@components/settings/SettingsLayout';
import { SettingsSectionSkeleton } from '@components/settings/SettingsSection';
import { WorkspaceNameSection } from '@components/settings/WorkspaceNameSection';
import { WorkspaceLogoSection } from '@components/settings/WorkspaceLogoSection';
import { WorkspaceRegionSection } from '@components/settings/WorkspaceRegionSection';

function GeneralSettingsPage() {
  const router = useRouter();
  const workspaceId = typeof router.query.workspaceId === 'string' ? router.query.workspaceId : undefined;

  return (
    <SettingsLayout page="general">
      {workspaceId ? (
        <>
          <WorkspaceNameSection workspaceId={workspaceId} />
          <WorkspaceLogoSection key={workspaceId} workspaceId={workspaceId} />
          <WorkspaceRegionSection workspaceId={workspaceId} />
        </>
      ) : (
        <>
          <SettingsSectionSkeleton rows={1} />
          <SettingsSectionSkeleton rows={2} />
        </>
      )}
    </SettingsLayout>
  );
}

export default withPagePermission(['ADMIN'], GeneralSettingsPage, '/workspaces/[workspaceId]/manage');
