import React from 'react';
import { useRouter } from 'next/router';
import { withPagePermission } from '@middleware/ui/withPagePermission';
import { SettingsLayout } from '@components/settings/SettingsLayout';
import { SettingsSectionSkeleton } from '@components/settings/SettingsSection';
import { DangerZoneSection } from '@components/settings/DangerZoneSection';

function DangerSettingsPage() {
  const router = useRouter();
  const workspaceId = typeof router.query.workspaceId === 'string' ? router.query.workspaceId : undefined;

  return <SettingsLayout page="danger">{workspaceId ? <DangerZoneSection workspaceId={workspaceId} /> : <SettingsSectionSkeleton rows={1} />}</SettingsLayout>;
}

export default withPagePermission(['ADMIN'], DangerSettingsPage, '/workspaces/[workspaceId]/manage');
