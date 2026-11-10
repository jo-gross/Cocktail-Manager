import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { SettingsSectionSkeleton } from '@components/settings/SettingsSection';

/** Legacy URL: the translation center now lives in the settings area. */
export default function LegacyTranslationsRedirect() {
  const router = useRouter();
  const workspaceId = typeof router.query.workspaceId === 'string' ? router.query.workspaceId : undefined;

  useEffect(() => {
    if (!workspaceId) return;
    void router.replace(`/workspaces/${workspaceId}/manage/settings/translations`);
  }, [router, workspaceId]);

  return (
    <div className="mx-auto w-full max-w-4xl p-4 md:p-5">
      <SettingsSectionSkeleton rows={4} />
    </div>
  );
}
