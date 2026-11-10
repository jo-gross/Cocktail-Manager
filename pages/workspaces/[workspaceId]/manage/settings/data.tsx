import React from 'react';
import { useRouter } from 'next/router';
import { withPagePermission } from '@middleware/ui/withPagePermission';
import { SettingsLayout } from '@components/settings/SettingsLayout';
import { SettingsSectionSkeleton } from '@components/settings/SettingsSection';
import { DataTransferSection } from '@components/settings/DataTransferSection';

function DataSettingsPage() {
  const router = useRouter();
  const workspaceId = typeof router.query.workspaceId === 'string' ? router.query.workspaceId : undefined;

  return <SettingsLayout page="data">{workspaceId ? <DataTransferSection workspaceId={workspaceId} /> : <SettingsSectionSkeleton rows={2} />}</SettingsLayout>;
}

export default withPagePermission(['ADMIN'], DataSettingsPage, '/workspaces/[workspaceId]/manage');
