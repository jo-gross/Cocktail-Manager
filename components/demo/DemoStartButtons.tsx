import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Loading as UiLoading } from '@components/ui';
import { alertService } from '@lib/alertService';
import { getActiveLocale } from '@lib/i18n/client';

export interface DemoConfig {
  enabled: boolean;
  ttlHours: number | null;
}

/** Runtime demo flag of the instance (`/api/config/demo`); `null` while loading, disabled on errors. */
export function useDemoConfig(): DemoConfig | null {
  const [config, setConfig] = useState<DemoConfig | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/config/demo', { method: 'GET' })
      .then(async (response) => {
        const body = await response.json();
        if (!cancelled) setConfig(response.ok ? body.data : { enabled: false, ttlHours: null });
      })
      .catch((error) => {
        console.error('useDemoConfig', error);
        if (!cancelled) setConfig({ enabled: false, ttlHours: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return config;
}

type DemoMode = 'full' | 'setup';

/** Login card of a demo instance: sample bar or empty workspace in the setup assistant. */
export function DemoStartButtons({ ttlHours }: { ttlHours: number | null }) {
  const { t } = useTranslation('auth');
  const [creating, setCreating] = useState<DemoMode | null>(null);

  const startDemo = useCallback(
    async (mode: DemoMode) => {
      setCreating(mode);
      try {
        const response = await fetch('/api/demo/create-workspace', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locale: getActiveLocale(), mode }),
        });
        const body = await response.json();
        if (!response.ok) {
          alertService.error(body.error?.message ?? body.message ?? t('error.createDemoWorkspace'), response.status, response.statusText);
          setCreating(null);
          return;
        }

        // Exchange the one-time token for a session.
        const signInResponse = await fetch('/api/auth/demo-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: body.data.userId, loginToken: body.data.loginToken }),
        });
        if (!signInResponse.ok) {
          alertService.error(t('error.demoLogin'));
          setCreating(null);
          return;
        }
        const workspacePath = `/workspaces/${body.data.workspaceId}`;
        // Full load (the buttons stay busy): the client session store only picks up the new cookie on a fresh start.
        window.location.assign(mode === 'setup' ? `${workspacePath}/setup` : workspacePath);
      } catch (error) {
        console.error('DemoStartButtons -> startDemo', error);
        alertService.error(t('error.createDemoWorkspace'));
        setCreating(null);
      }
    },
    [t],
  );

  return (
    <div className="flex w-full flex-col gap-2">
      <Button variant="primary" className="w-full" onClick={() => startDemo('full')} disabled={creating != null}>
        {creating === 'full' ? (
          <>
            <UiLoading size="sm" />
            {t('demoCreating')}
          </>
        ) : (
          t('demoStart')
        )}
      </Button>
      <Button variant="outline" className="w-full" onClick={() => startDemo('setup')} disabled={creating != null}>
        {creating === 'setup' ? (
          <>
            <UiLoading size="sm" />
            {t('demoCreating')}
          </>
        ) : (
          t('demoTrySetup')
        )}
      </Button>
      {ttlHours != null && <p className="text-center text-xs text-base-content/60">{t('demoHint', { hours: ttlHours })}</p>}
    </div>
  );
}
