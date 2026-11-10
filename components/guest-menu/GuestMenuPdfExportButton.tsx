/**
 * PDF export for guest menus (print output) + table tent QR cards. Checks the
 * Chromium PDF service (`/api/chromium-status`); without it the button opens the
 * self-contained print HTML so the browser's print dialog can be used instead.
 *
 *   <GuestMenuPdfExportButton workspaceId={ws} menuId={menu.id} source="draft" locale="en" />
 */
import React, { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaFileDownload, FaFilePdf } from 'react-icons/fa';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { alertService } from '@lib/alertService';
import { alertApiV1Error } from '@lib/network/apiV1';
import {
  exportGuestMenuPdf,
  exportGuestMenuTableTentPdf,
  getGuestMenu,
  getGuestMenuPrintHtmlUrl,
  isPdfExportAvailable,
  type GuestMenuPrintPaper,
} from '@lib/network/guestMenus';
import { fetchWorkspaceSettingsSafe } from '@lib/network/workspaces';
import { getAllContentLocales, parseContentLocales } from '@lib/workspace/workspaceLocaleSettings';
import { Button, Divider, FormControl, Label, LabelText, Loading, Select, Toggle, Tooltip, type ButtonProps } from '@components/ui';

export interface GuestMenuPdfExportButtonProps {
  workspaceId: string;
  menuId: string;
  source: 'draft' | 'published';
  /** Preselected content locale (default: `outputs.print.locale` → primary). */
  locale?: string;
  /** Icon-only button. */
  compact?: boolean;
  size?: ButtonProps['size'];
  variant?: ButtonProps['variant'];
  className?: string;
}

const PAPERS: GuestMenuPrintPaper[] = ['A4', 'A5', 'DL'];

function downloadBlob(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
}

interface ModalProps {
  workspaceId: string;
  menuId: string;
  source: 'draft' | 'published';
  locale?: string;
}

export function GuestMenuPdfExportModal({ workspaceId, menuId, source, locale: initialLocale }: ModalProps) {
  const { t } = useTranslation(['guestMenu', 'common']);
  const [loading, setLoading] = useState(true);
  const [menuLocales, setMenuLocales] = useState<string[]>([]);
  const [workspaceLocales, setWorkspaceLocales] = useState<string[]>([]);
  const [paper, setPaper] = useState<GuestMenuPrintPaper>('A4');
  const [locale, setLocale] = useState<string>(initialLocale ?? '');
  const [showQrCode, setShowQrCode] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [tentTarget, setTentTarget] = useState<'bar' | 'menu'>('bar');
  const [tentPaper, setTentPaper] = useState<'A6' | 'A5'>('A6');
  const [exportingTent, setExportingTent] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getGuestMenu(workspaceId, menuId)
      .then((menu) => {
        if (cancelled) return;
        const print = (source === 'published' && menu.published ? menu.published : menu.draft).outputs.print;
        setPaper(print.paper);
        setShowQrCode(print.showQrCode);
        if (!initialLocale && print.locale) setLocale(print.locale);
        setMenuLocales(menu.locales);
      })
      .catch((error) => alertApiV1Error(error, t('guestMenu:export.loadError')))
      .finally(() => !cancelled && setLoading(false));
    fetchWorkspaceSettingsSafe(workspaceId, (settings) => {
      if (!cancelled) setWorkspaceLocales(getAllContentLocales(parseContentLocales(settings.contentLocales)));
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, menuId, source, initialLocale, t]);

  const locales = menuLocales.length > 0 ? [...new Set([workspaceLocales[0], ...menuLocales].filter(Boolean))] : workspaceLocales;
  const params = { source, paper, showQrCode, locale: locale || undefined };

  const exportPdf = async () => {
    setExporting(true);
    try {
      alertService.info(t('guestMenu:export.running'));
      const { blob, fileName } = await exportGuestMenuPdf(workspaceId, menuId, params);
      downloadBlob(blob, fileName);
      alertService.success(t('guestMenu:export.success'));
    } catch (error) {
      alertApiV1Error(error, t('guestMenu:export.error'));
    } finally {
      setExporting(false);
    }
  };

  const exportTableTent = async () => {
    setExportingTent(true);
    try {
      const { blob, fileName } = await exportGuestMenuTableTentPdf(workspaceId, menuId, { target: tentTarget, paper: tentPaper, locale: locale || undefined });
      downloadBlob(blob, fileName);
    } catch (error) {
      alertApiV1Error(error, t('guestMenu:export.error'));
    } finally {
      setExportingTent(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <div className={'flex flex-col gap-4'}>
      <div className={'text-2xl font-bold'}>{t('guestMenu:export.title')}</div>
      <div className={'text-sm text-base-content/70'}>{t(source === 'draft' ? 'guestMenu:export.sourceDraft' : 'guestMenu:export.sourcePublished')}</div>

      <div className={'grid grid-cols-1 gap-3 sm:grid-cols-2'}>
        <FormControl>
          <Label>
            <LabelText>{t('guestMenu:export.paper')}</LabelText>
          </Label>
          <Select value={paper} onChange={(event) => setPaper(event.target.value as GuestMenuPrintPaper)}>
            {PAPERS.map((value) => (
              <option key={value} value={value}>
                {t(`guestMenu:export.papers.${value}`)}
              </option>
            ))}
          </Select>
        </FormControl>
        <FormControl>
          <Label>
            <LabelText>{t('guestMenu:export.locale')}</LabelText>
          </Label>
          <Select value={locale} onChange={(event) => setLocale(event.target.value)}>
            <option value={''}>{t('guestMenu:export.localeDefault')}</option>
            {locales.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </FormControl>
      </div>
      <FormControl>
        <Label className="cursor-pointer flex-row items-center justify-start gap-2">
          <Toggle checked={showQrCode} onChange={(event) => setShowQrCode(event.target.checked)} />
          <LabelText>{t('guestMenu:export.showQrCode')}</LabelText>
        </Label>
      </FormControl>

      <div className={'flex flex-row flex-wrap justify-end gap-2'}>
        <Button type="button" variant="outline" onClick={() => window.open(getGuestMenuPrintHtmlUrl(workspaceId, menuId, params), '_blank', 'noopener')}>
          {t('guestMenu:export.htmlPreview')}
        </Button>
        <Button type="button" variant="primary" onClick={exportPdf} loading={exporting} disabled={exporting}>
          <FaFilePdf />
          {t('guestMenu:export.createPdf')}
        </Button>
      </div>

      <Divider className="my-0" />

      <div className={'flex flex-col gap-3'}>
        <div className={'text-lg font-semibold'}>{t('guestMenu:export.tableTent.title')}</div>
        <div className={'text-sm text-base-content/70'}>{t('guestMenu:export.tableTent.description')}</div>
        <div className={'grid grid-cols-1 gap-3 sm:grid-cols-2'}>
          <FormControl>
            <Label>
              <LabelText>{t('guestMenu:export.tableTent.target')}</LabelText>
            </Label>
            <Select value={tentTarget} onChange={(event) => setTentTarget(event.target.value as 'bar' | 'menu')}>
              <option value={'bar'}>{t('guestMenu:qrTargetBar')}</option>
              <option value={'menu'}>{t('guestMenu:qrTargetMenu')}</option>
            </Select>
          </FormControl>
          <FormControl>
            <Label>
              <LabelText>{t('guestMenu:export.paper')}</LabelText>
            </Label>
            <Select value={tentPaper} onChange={(event) => setTentPaper(event.target.value as 'A6' | 'A5')}>
              <option value={'A6'}>{t('guestMenu:export.papers.A6')}</option>
              <option value={'A5'}>{t('guestMenu:export.papers.A5')}</option>
            </Select>
          </FormControl>
        </div>
        <div className={'flex justify-end'}>
          <Button type="button" variant="outline" onClick={exportTableTent} loading={exportingTent} disabled={exportingTent}>
            <FaFileDownload />
            {t('guestMenu:export.tableTent.download')}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function GuestMenuPdfExportButton({
  workspaceId,
  menuId,
  source,
  locale,
  compact = false,
  size = 'sm',
  variant = 'outline',
  className,
}: GuestMenuPdfExportButtonProps) {
  const { t } = useTranslation(['guestMenu']);
  const modalContext = useContext(ModalContext);
  const [available, setAvailable] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    isPdfExportAvailable().then((value) => !cancelled && setAvailable(value));
    return () => {
      cancelled = true;
    };
  }, []);

  const onClick = () => {
    if (available) {
      modalContext.openModal(<GuestMenuPdfExportModal workspaceId={workspaceId} menuId={menuId} source={source} locale={locale} />);
    } else {
      // No PDF service: open the print HTML and let the browser print it.
      window.open(getGuestMenuPrintHtmlUrl(workspaceId, menuId, { source, locale }), '_blank', 'noopener');
    }
  };

  const tip = available === false ? t('guestMenu:export.unavailableTip') : t('guestMenu:export.buttonTip');
  return (
    <Tooltip tip={tip}>
      <Button
        type="button"
        size={size}
        variant={variant}
        shape={compact ? 'square' : 'default'}
        className={className}
        onClick={onClick}
        disabled={available === undefined}
        aria-label={t('guestMenu:export.button')}
      >
        <FaFilePdf />
        {compact ? null : t('guestMenu:export.button')}
      </Button>
    </Tooltip>
  );
}

export default GuestMenuPdfExportButton;
