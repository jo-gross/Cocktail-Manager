import React, { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaArrowUpRightFromSquare, FaCopy } from 'react-icons/fa6';
import { Button, ButtonGroup, FormControl, Input, Label, LabelText, LabelTextAlt, Loading, Skeleton } from '@components/ui';
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
          <FormControl>
            <Label htmlFor="workspace-public-slug" className="justify-between">
              <LabelText className="font-semibold">{t('settings:public.slugLabel')}</LabelText>
              <LabelTextAlt id="workspace-public-slug-error" className="text-error">
                {slugReserved ? t('settings:publicSlugReserved') : slugError ? t('settings:publicSlugInvalid') : ''}
              </LabelTextAlt>
            </Label>
            <ButtonGroup>
              <span aria-hidden className="flex items-center border border-base-300 bg-base-200 px-3 font-mono text-sm text-base-content/60">
                {'/m/'}
              </span>
              <Input
                id="workspace-public-slug"
                type="text"
                joinItem
                value={slug}
                error={slugError}
                aria-invalid={slugError || undefined}
                aria-describedby="workspace-public-slug-error workspace-public-slug-help"
                placeholder={t('settings:publicSlugPlaceholder')}
                maxLength={WORKSPACE_PUBLIC_SLUG_MAX_LENGTH}
                autoComplete="off"
                onChange={(event) => setSlug(event.target.value.toLowerCase())}
              />
            </ButtonGroup>
            <p id="workspace-public-slug-help" className="mt-1 text-xs text-base-content/60">
              {t('settings:publicSlugHelp', { slug: trimmed || '…' })}
            </p>
          </FormControl>

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
