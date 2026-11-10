/**
 * Monitor key of the workspace (admin): show/copy the monitor link with key and
 * (re)generate the key. Only monitors opened with the key can show PIN-protected
 * guest menus; regenerating invalidates old links.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaKey, FaLock } from 'react-icons/fa';
import { alertService } from '@lib/alertService';
import { alertApiV1Error } from '@lib/network/apiV1';
import { regenerateSignageKey } from '@lib/network/signage';
import type { SignageKeyDto } from '@lib/schemas/signage';
import { Alert, Button, Input, Loading } from '@components/ui';

interface SignageKeySectionProps {
  workspaceId: string;
  signageKey: SignageKeyDto | null;
  /** At least one guest menu slide shows a PIN-protected menu. */
  hasProtectedMenuSlides: boolean;
  onChange: (signageKey: SignageKeyDto) => void;
}

export function SignageKeySection({ workspaceId, signageKey, hasProtectedMenuSlides, onChange }: SignageKeySectionProps) {
  const { t } = useTranslation(['monitor', 'common', 'errors']);
  const [regenerating, setRegenerating] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const hasKey = Boolean(signageKey?.key);
  const monitorUrl = signageKey && typeof window !== 'undefined' ? `${window.location.origin}${signageKey.monitorPath}` : '';

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      onChange(await regenerateSignageKey(workspaceId));
      alertService.success(t('monitor:signageKey.generated'));
      setConfirming(false);
    } catch (error) {
      alertApiV1Error(error, t('errors:generic'));
    } finally {
      setRegenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!monitorUrl) return;
    await navigator.clipboard.writeText(monitorUrl);
    alertService.info(t('common:success.copied'));
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-base-300 p-3">
      <div className="flex items-center gap-2 font-semibold">
        <FaKey /> {t('monitor:signageKey.title')}
      </div>
      <p className="text-sm text-base-content/70">{t('monitor:signageKey.description')}</p>
      {hasProtectedMenuSlides ? (
        <Alert variant={hasKey ? 'info' : 'warning'} icon={<FaLock />}>
          {t('monitor:signageKey.protectedMenuHint')}
          {hasKey ? null : ` ${t('monitor:signageKey.noKeyYet')}`}
        </Alert>
      ) : null}
      {hasKey ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input readOnly value={monitorUrl} aria-label={t('monitor:signageKey.linkLabel')} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
          <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
            {t('common:copyLink')}
          </Button>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {hasKey && confirming ? (
          <>
            <span className="text-sm">{t('monitor:signageKey.regenerateConfirm')}</span>
            <Button type="button" variant="error" size="sm" disabled={regenerating} onClick={handleRegenerate}>
              {regenerating ? <Loading size="sm" /> : null}
              {t('monitor:signageKey.regenerate')}
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={regenerating} onClick={() => setConfirming(false)}>
              {t('common:cancel')}
            </Button>
          </>
        ) : (
          <Button type="button" variant="outline" size="sm" disabled={regenerating} onClick={() => (hasKey ? setConfirming(true) : void handleRegenerate())}>
            {regenerating ? <Loading size="sm" /> : null}
            {hasKey ? t('monitor:signageKey.regenerate') : t('monitor:signageKey.generate')}
          </Button>
        )}
      </div>
    </div>
  );
}
