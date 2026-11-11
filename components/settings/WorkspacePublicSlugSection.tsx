import React, { useContext, useEffect, useState } from 'react';
import { useReportUnsavedChanges } from '@lib/forms/useUnsavedChanges';
import { useTranslation } from 'react-i18next';
import { FaArrowUpRightFromSquare, FaCopy } from 'react-icons/fa6';
import { Button, ButtonGroup, Input, InputAddon, Loading, Skeleton } from '@components/ui';
import { FormField } from '@components/forms/FormField';
import { UserContext } from '@lib/context/UserContextProvider';
import { alertService } from '@lib/alertService';
import { alertApiV1Error } from '@lib/network/apiV1';
import { getWorkspace, updateWorkspace } from '@lib/network/workspaces';
import {
  isReservedPublicSlug,
  WORKSPACE_PUBLIC_SLUG_MAX_LENGTH,
  WORKSPACE_PUBLIC_SLUG_MIN_LENGTH,
  WORKSPACE_PUBLIC_SLUG_PATTERN,
} from '@lib/schemas/workspace';
import { SettingsSection } from './SettingsSection';

export function isValidPublicSlug(slug: string): boolean {
  return slug.length >= WORKSPACE_PUBLIC_SLUG_MIN_LENGTH && slug.length <= WORKSPACE_PUBLIC_SLUG_MAX_LENGTH && WORKSPACE_PUBLIC_SLUG_PATTERN.test(slug);
}

/** Public address of the bar (`/m/{slug}`) used by published guest menus. */
export function WorkspacePublicSlugSection({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation(['settings', 'common', 'errors']);
  const { refreshWorkspace } = useContext(UserContext);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [slug, setSlug] = useState('');
  const [savedSlug, setSavedSlug] = useState('');
  // Only rendered after the client-side load, so reading window here is safe.
  const origin = typeof window === 'undefined' ? '' : window.location.origin;

  useEffect(() => {
    let cancelled = false;
    getWorkspace(workspaceId)
      .then((workspace) => {
        if (cancelled) return;
        setSlug(workspace.publicSlug ?? '');
        setSavedSlug(workspace.publicSlug ?? '');
      })
      .catch((error) => alertApiV1Error(error, t('errors:loadSettings')))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, t]);

  const trimmed = slug.trim();
  const slugReserved = trimmed !== '' && isReservedPublicSlug(trimmed);
  const slugError = (trimmed !== '' && !isValidPublicSlug(trimmed)) || slugReserved;
  const dirty = trimmed !== savedSlug;
  useReportUnsavedChanges(!loading && dirty);
  const publicUrl = savedSlug ? `${origin}/m/${savedSlug}` : '';

  const save = async () => {
    if (slugError || !dirty) return;
    setSaving(true);
    try {
      await updateWorkspace(workspaceId, { publicSlug: trimmed === '' ? null : trimmed });
      setSavedSlug(trimmed);
      setSlug(trimmed);
      void refreshWorkspace();
      alertService.success(t('settings:settingSaved'));
    } catch (error) {
      alertApiV1Error(error, t('errors:save'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsSection
      title={t('settings:publicSlug')}
      description={t('settings:public.slugDescription')}
      footer={
        <Button type="button" variant="primary" onClick={save} disabled={loading || saving || slugError || !dirty}>
          {saving ? <Loading size="sm" /> : null}
          {t('common:save')}
        </Button>
      }
    >
      {loading ? (
        <Skeleton className="h-16 w-full" />
      ) : (
        <>
          <FormField
            label={t('settings:public.slugLabel')}
            htmlFor="workspace-public-slug"
            error={slugReserved ? t('settings:publicSlugReserved') : slugError ? t('settings:publicSlugInvalid') : undefined}
            hint={<span id="workspace-public-slug-help">{t('settings:publicSlugHelp', { slug: trimmed || '…' })}</span>}
          >
            <ButtonGroup>
              <InputAddon aria-hidden className="font-mono">
                {'/m/'}
              </InputAddon>
              <Input
                id="workspace-public-slug"
                type="text"
                joinItem
                value={slug}
                error={slugError}
                aria-describedby="workspace-public-slug-error workspace-public-slug-help"
                placeholder={t('settings:publicSlugPlaceholder')}
                maxLength={WORKSPACE_PUBLIC_SLUG_MAX_LENGTH}
                autoComplete="off"
                onChange={(event) => setSlug(event.target.value.toLowerCase())}
              />
            </ButtonGroup>
          </FormField>

          {publicUrl ? (
            <div className="flex flex-col gap-2 rounded-xl border border-base-300 bg-base-100 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-col">
                <span className="text-xs font-semibold text-base-content/60">{t('settings:public.currentUrl')}</span>
                <span className="truncate font-mono text-sm">{publicUrl}</span>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => navigator.clipboard.writeText(publicUrl).then(() => alertService.info(t('common:success.copied')))}
                >
                  <FaCopy aria-hidden />
                  {t('common:copyLink')}
                </Button>
                <a
                  className="inline-flex h-9 min-h-9 items-center gap-1.5 rounded-lg border border-base-300 px-3 text-sm font-medium transition-colors hover:bg-base-200 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                  href={publicUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <FaArrowUpRightFromSquare aria-hidden />
                  {t('common:open')}
                </a>
              </div>
            </div>
          ) : null}
        </>
      )}
    </SettingsSection>
  );
}
