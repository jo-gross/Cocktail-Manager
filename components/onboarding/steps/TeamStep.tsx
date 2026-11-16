import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import { useTranslation } from 'react-i18next';
import { FaCopy } from 'react-icons/fa';
import { Button, ButtonGroup, Input, Loading, Skeleton } from '@components/ui';
import { FormSection } from '@components/forms/FormSection';
import { settingsHref } from '@components/settings/settingsNavigation';
import { alertService } from '@lib/alertService';
import { alertApiV1Error, apiV1Fetch } from '@lib/network/apiV1';
import { createJoinCode } from '@lib/network/workspaceUsers';
import type { JoinCodeDto } from '@lib/schemas/joinCodes';
import type { SetupStepProps } from './types';

const ROLES = ['USER', 'MANAGER', 'ADMIN', 'OWNER'] as const;

/** A code that still lets people join: not expired and not a used one-time code. */
function usableCode(codes: JoinCodeDto[]): JoinCodeDto | undefined {
  const now = Date.now();
  return codes.find((code) => (!code.expires || Date.parse(code.expires) > now) && !(code.onlyUseOnce && code.used > 0));
}

export function joinLink(code: string): string {
  return `${window.location.origin}/?code=${encodeURIComponent(code)}`;
}

/** Step 4 (optional): invitation link with QR code; members join via a request that a manager confirms. */
export function TeamStep({ workspaceId, saveRef, onLinkChange }: SetupStepProps & { onLinkChange: (link: string | null) => void }) {
  const { t } = useTranslation(['onboarding', 'common', 'errors']);
  const [code, setCode] = useState<string | null | undefined>(undefined);
  const [creating, setCreating] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const link = code ? joinLink(code) : null;

  useEffect(() => {
    saveRef.current = async () => true;
  }, [saveRef]);

  useEffect(() => {
    let cancelled = false;
    apiV1Fetch<JoinCodeDto[]>(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/join-codes`)
      .then((codes) => {
        if (!cancelled) setCode(usableCode(codes)?.code ?? null);
      })
      .catch((error) => {
        console.error('TeamStep -> join codes', error);
        if (!cancelled) setCode(null);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  useEffect(() => {
    onLinkChange(link);
    if (!link) return;
    let cancelled = false;
    QRCode.toDataURL(link, { margin: 1, width: 320, errorCorrectionLevel: 'M' })
      .then((url) => !cancelled && setQr(url))
      .catch(() => !cancelled && setQr(null));
    return () => {
      cancelled = true;
    };
  }, [link, onLinkChange]);

  const create = async () => {
    setCreating(true);
    try {
      const created = await createJoinCode(workspaceId, {});
      setCode(created.code);
    } catch (error) {
      alertApiV1Error(error, t('errors:create'));
    } finally {
      setCreating(false);
    }
  };

  const copy = () => {
    if (!link) return;
    navigator.clipboard
      .writeText(link)
      .then(() => alertService.success(t('onboarding:team.copied')))
      .catch(() => alertService.error(t('onboarding:team.copyError')));
  };

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <FormSection title={t('onboarding:team.linkTitle')} description={t('onboarding:team.linkHelp')}>
        {code === undefined ? (
          <Skeleton className="h-40 w-full" />
        ) : link ? (
          <div className="grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_auto]">
            <div className="flex min-w-0 flex-col gap-2">
              <label htmlFor="setup-join-link" className="text-sm font-medium">
                {t('onboarding:team.link')}
              </label>
              <ButtonGroup className="w-full">
                <Input id="setup-join-link" joinItem readOnly className="w-full min-w-0" value={link} onFocus={(event) => event.target.select()} />
                <Button type="button" variant="outline" joinItem onClick={copy}>
                  <FaCopy aria-hidden />
                  {t('onboarding:team.copy')}
                </Button>
              </ButtonGroup>
              <p className="text-xs text-base-content/60">{t('onboarding:team.code', { code })}</p>
            </div>
            <div className="flex justify-center">
              {qr ? (
                // eslint-disable-next-line @next/next/no-img-element -- data URL
                <img src={qr} alt={t('onboarding:team.qrAlt')} width={160} height={160} className="h-40 w-40 rounded-xl border border-base-300 bg-white p-2" />
              ) : (
                <Skeleton className="h-40 w-40 rounded-xl" />
              )}
            </div>
          </div>
        ) : (
          <Button type="button" variant="primary" className="self-start" disabled={creating} onClick={create}>
            {creating ? <Loading size="sm" /> : null}
            {t('onboarding:team.create')}
          </Button>
        )}
      </FormSection>

      <FormSection
        title={t('onboarding:team.rolesTitle')}
        description={t('onboarding:team.rolesHelp')}
        footer={
          <Link href={settingsHref(workspaceId, 'users')} className="link text-sm">
            {t('onboarding:team.manage')}
          </Link>
        }
      >
        <dl className="divide-y divide-base-300 overflow-hidden rounded-lg border border-base-300 bg-base-100 text-sm">
          {ROLES.map((role) => (
            <div key={role} className="flex flex-col gap-0.5 px-3 py-2.5 sm:flex-row sm:gap-4">
              <dt className="w-24 shrink-0 font-semibold">{t(`onboarding:team.roles.${role}.name`)}</dt>
              <dd className="text-base-content/70">{t(`onboarding:team.roles.${role}.help`)}</dd>
            </div>
          ))}
        </dl>
      </FormSection>
    </div>
  );
}
