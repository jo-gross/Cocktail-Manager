/** Builder top bar: name/status, locale + output + device switchers, undo/redo, autosave state, phone test, publish. */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import {
  FaArrowLeft,
  FaCheck,
  FaCloudUploadAlt,
  FaDesktop,
  FaExclamationTriangle,
  FaMobileAlt,
  FaPrint,
  FaQrcode,
  FaRedo,
  FaSyncAlt,
  FaTabletAlt,
  FaUndo,
} from 'react-icons/fa';
import { Badge, Button, cn, Dropdown, DropdownContent, Spinner } from '@components/ui';
import { alertService } from '@lib/alertService';
import { alertApiV1Error } from '@lib/network/apiV1';
import { regenerateGuestMenuPreviewToken } from '@lib/network/guestMenus';
import { getTranslationProgress } from '@lib/guest-menu/builder';
import { GuestMenuPdfExportButton } from '../GuestMenuPdfExportButton';
import { useBuilder, type PreviewDevice, type PreviewMode } from './BuilderContext';
import { Segmented, useLanguageName } from './controls';

export type SaveStatus = 'saved' | 'dirty' | 'saving' | 'error' | 'invalid';

interface BuilderTopBarProps {
  backLink: string;
  saveStatus: SaveStatus;
  saveError: string | null;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  setLocale: (locale: string) => void;
  setPreviewMode: (mode: PreviewMode) => void;
  device: PreviewDevice;
  setDevice: (device: PreviewDevice) => void;
  publishing: boolean;
  onPublish: () => void;
  onUnpublish: () => void;
}

function PhoneTestButton() {
  const { t } = useTranslation('guestMenu');
  const { workspaceId, menu, setMenu, canEdit } = useBuilder();
  const [svg, setSvg] = useState<string | null>(null);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const regenerate = async () => {
    setRegenerating(true);
    try {
      const updated = await regenerateGuestMenuPreviewToken(workspaceId, menu.id);
      // Keep the local (possibly not yet autosaved) draft.
      setMenu({ ...updated, draft: menu.draft });
      setConfirmRegenerate(false);
      alertService.success(t('builder.topBar.previewLinkRegenerated'));
    } catch (error) {
      alertApiV1Error(error, t('errors.save'));
    } finally {
      setRegenerating(false);
    }
  };
  const url = useMemo(() => {
    if (!menu.previewToken || typeof window === 'undefined') return null;
    return `${window.location.origin}${menu.publicPath}?preview=${encodeURIComponent(menu.previewToken)}`;
  }, [menu.previewToken, menu.publicPath]);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    import('qrcode').then((QRCode) =>
      QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }).then((value) => {
        if (!cancelled) setSvg(value);
      }),
    );
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!url) return null;
  return (
    <Dropdown align="end">
      <Button type="button" size="sm" variant="outline" title={t('builder.topBar.testOnPhone')}>
        <FaQrcode /> <span className="hidden 2xl:inline">{t('builder.topBar.testOnPhone')}</span>
      </Button>
      <DropdownContent className="w-72 p-3">
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-sm font-semibold">{t('builder.topBar.testOnPhone')}</p>
          {svg ? <div className="w-48 bg-white p-2 [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} /> : <Spinner />}
          <p className="text-xs text-base-content/60">{t('builder.topBar.testOnPhoneHint')}</p>
          <div className="flex gap-2">
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(url);
                alertService.success(t('linkCopied'));
              }}
            >
              {t('copyLink')}
            </Button>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-md border border-base-300 px-2 text-xs hover:bg-base-200"
            >
              {t('open')}
            </a>
          </div>
          {canEdit &&
            (confirmRegenerate ? (
              <div className="flex flex-col items-center gap-1 border-t border-base-300 pt-2">
                <p className="text-xs text-warning">{t('builder.topBar.regeneratePreviewLinkConfirm')}</p>
                <div className="flex gap-2">
                  <Button type="button" size="xs" variant="ghost" onClick={() => setConfirmRegenerate(false)} disabled={regenerating}>
                    {t('access.cancel')}
                  </Button>
                  <Button type="button" size="xs" variant="warning" loading={regenerating} onClick={regenerate}>
                    {t('builder.topBar.regeneratePreviewLink')}
                  </Button>
                </div>
              </div>
            ) : (
              <Button type="button" size="xs" variant="ghost" onClick={() => setConfirmRegenerate(true)}>
                <FaSyncAlt aria-hidden /> {t('builder.topBar.regeneratePreviewLink')}
              </Button>
            ))}
        </div>
      </DropdownContent>
    </Dropdown>
  );
}

export function BuilderTopBar(props: BuilderTopBarProps) {
  const { t } = useTranslation('guestMenu');
  const { workspaceId, menu, document, locale, locales, primaryLocale, previewMode, canEdit } = useBuilder();
  const languageName = useLanguageName();

  const statusBadge = !menu.isPublished ? (
    <Badge size="sm" variant="ghost">
      {t('builder.status.draft')}
    </Badge>
  ) : menu.hasUnpublishedChanges ? (
    <Badge size="sm" variant="warning">
      {t('unpublishedChanges')}
    </Badge>
  ) : (
    <Badge size="sm" variant="success">
      {t('published')}
    </Badge>
  );

  const saveIndicator = {
    saved: (
      <span className="flex items-center gap-1 text-success">
        <FaCheck /> {t('builder.save.saved')}
      </span>
    ),
    dirty: <span className="text-base-content/60">{t('builder.save.dirty')}</span>,
    saving: (
      <span className="flex items-center gap-1 text-base-content/60">
        <Spinner size="xs" /> {t('builder.save.saving')}
      </span>
    ),
    error: (
      <span className="flex items-center gap-1 text-error" title={props.saveError ?? undefined}>
        <FaExclamationTriangle /> {t('builder.save.error')}
      </span>
    ),
    invalid: (
      <span className="flex items-center gap-1 text-warning" title={props.saveError ?? undefined}>
        <FaExclamationTriangle /> {t('builder.save.invalid')}
      </span>
    ),
  }[props.saveStatus];

  const progress = (target: string) => {
    const result = getTranslationProgress(document, target);
    return result.total === 0 ? 100 : Math.round((result.translated / result.total) * 100);
  };

  return (
    <div className="flex flex-col gap-2 border-b border-base-300 bg-base-100 px-2 py-2 md:px-3">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={props.backLink} aria-label={t('builder.topBar.back')} title={t('builder.topBar.back')}>
          <Button type="button" size="sm" variant="ghost" shape="square">
            <FaArrowLeft />
          </Button>
        </Link>
        <div className="flex min-w-0 flex-col">
          <h1 className="truncate text-base leading-tight font-bold">{menu.name}</h1>
          <div className="flex flex-wrap items-center gap-1 text-xs">
            {statusBadge}
            {menu.isActive && (
              <Badge size="sm" variant="primary">
                {t('status.active')}
              </Badge>
            )}
            <span className="ml-1" aria-live="polite">
              {saveIndicator}
            </span>
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            shape="square"
            disabled={!props.canUndo}
            onClick={props.onUndo}
            title={t('builder.topBar.undo')}
            aria-label={t('builder.topBar.undo')}
          >
            <FaUndo />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            shape="square"
            disabled={!props.canRedo}
            onClick={props.onRedo}
            title={t('builder.topBar.redo')}
            aria-label={t('builder.topBar.redo')}
          >
            <FaRedo />
          </Button>
          <PhoneTestButton />
          <GuestMenuPdfExportButton workspaceId={workspaceId} menuId={menu.id} source="draft" locale={locale} compact variant="outline" />
          {canEdit && menu.isPublished && (
            <Button type="button" size="sm" variant="ghost" onClick={props.onUnpublish} disabled={props.publishing}>
              <span className="hidden xl:inline">{t('unpublish')}</span>
              <span className="xl:hidden">{t('builder.topBar.unpublishShort')}</span>
            </Button>
          )}
          {canEdit && (
            <Button
              type="button"
              size="sm"
              variant="primary"
              loading={props.publishing}
              disabled={props.saveStatus === 'invalid' || (menu.isPublished && !menu.hasUnpublishedChanges && props.saveStatus === 'saved')}
              onClick={props.onPublish}
            >
              <FaCloudUploadAlt /> {t('publish')}
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {locales.length > 1 && (
          <div role="radiogroup" aria-label={t('builder.topBar.locale')} className="inline-flex items-center gap-0.5 rounded-lg bg-base-200 p-0.5">
            {locales.map((entry) => {
              const percent = progress(entry);
              return (
                <button
                  key={entry}
                  type="button"
                  role="radio"
                  aria-checked={locale === entry}
                  onClick={() => props.setLocale(entry)}
                  title={
                    entry === primaryLocale
                      ? t('builder.locale.primary', { language: languageName(entry) })
                      : t('builder.locale.progress', { language: languageName(entry), percent })
                  }
                  className={cn(
                    'flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium',
                    locale === entry ? 'bg-base-100 shadow-sm' : 'text-base-content/60 hover:text-base-content',
                  )}
                >
                  {entry.toUpperCase()}
                  {entry !== primaryLocale && (
                    <span className={cn('text-[0.65rem]', percent < 100 ? 'text-warning' : 'text-success')}>{t('builder.locale.percent', { percent })}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
        <Segmented<PreviewMode>
          value={previewMode}
          onChange={props.setPreviewMode}
          size="xs"
          ariaLabel={t('builder.topBar.output')}
          options={[
            { value: 'web', label: <FaMobileAlt />, title: t('builder.previewModes.web') },
            { value: 'monitor-landscape', label: <FaDesktop />, title: t('builder.previewModes.monitorLandscape') },
            { value: 'monitor-portrait', label: <FaDesktop className="rotate-90" />, title: t('builder.previewModes.monitorPortrait') },
            { value: 'print', label: <FaPrint />, title: t('builder.previewModes.print') },
          ]}
        />
        <span className="hidden text-xs text-base-content/60 sm:inline">
          {t(
            `builder.previewModes.${previewMode === 'web' ? 'web' : previewMode === 'print' ? 'print' : previewMode === 'monitor-portrait' ? 'monitorPortrait' : 'monitorLandscape'}`,
          )}
        </span>
        {previewMode === 'web' && (
          <Segmented<PreviewDevice>
            value={props.device}
            onChange={props.setDevice}
            size="xs"
            ariaLabel={t('builder.topBar.device')}
            options={[
              { value: 'phone', label: <FaMobileAlt />, title: t('builder.devices.phone') },
              { value: 'tablet', label: <FaTabletAlt />, title: t('builder.devices.tablet') },
              { value: 'desktop', label: <FaDesktop />, title: t('builder.devices.desktop') },
            ]}
          />
        )}
      </div>
    </div>
  );
}
