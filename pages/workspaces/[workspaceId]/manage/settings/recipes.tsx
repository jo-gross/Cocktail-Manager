import React from 'react';
import { useRouter } from 'next/router';
import { withPagePermission } from '@middleware/ui/withPagePermission';
import { SettingsLayout } from '@components/settings/SettingsLayout';
import { SettingsSectionSkeleton } from '@components/settings/SettingsSection';
import { PreparationActionsSection } from '@components/settings/PreparationActionsSection';
import { UnitsSection } from '@components/settings/UnitsSection';
import { IceSection } from '@components/settings/IceSection';

function RecipeSettingsPage() {
  const router = useRouter();
  const workspaceId = typeof router.query.workspaceId === 'string' ? router.query.workspaceId : undefined;

  return (
    <SettingsLayout page="recipes">
      {workspaceId ? (
        <>
          <PreparationActionsSection workspaceId={workspaceId} />
          <UnitsSection workspaceId={workspaceId} />
          <IceSection workspaceId={workspaceId} />
        </>
      ) : (
        <>
          <SettingsSectionSkeleton rows={4} />
          <SettingsSectionSkeleton rows={4} />
        </>
      )}
    </SettingsLayout>
  );
}

export default withPagePermission(['ADMIN'], RecipeSettingsPage, '/workspaces/[workspaceId]/manage');
