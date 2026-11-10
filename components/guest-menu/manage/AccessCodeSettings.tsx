/**
 * Guest access code (PIN) of a menu: set / change / remove (PATCH `accessCode`)
 * and download a QR code whose link unlocks the menu (`?code=`). The code is
 * stored hashed – it can never be shown again, only replaced.
 * Used in the builder ("Zeitplan & Quelle" → "Zugang") and as modal on the list page.
 */
import { useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaDownload, FaEye, FaEyeSlash, FaLock, FaLockOpen } from 'react-icons/fa';
import { Button, Input } from '@components/ui';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { alertService } from '@lib/alertService';
import { ApiV1RequestError, alertApiV1Error } from '@lib/network/apiV1';
import { fetchGuestMenuQrWithCode, updateGuestMenu } from '@lib/network/guestMenus';
import type { GuestMenuDto, GuestMenuSummaryDto } from '@lib/schemas/guestMenus';

const CODE_PATTERN = /^[A-Za-z0-9]{4,12}$/;

function downloadSvg(svg: string, filename: string) {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function CodeInput({
  id,
  value,
  onChange,
  invalid,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
  disabled?: boolean;
}) {
  const { t } = useTranslation('guestMenu');
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex gap-1">
      <Input
        id={id}
        inputSize="sm"
        type={visible ? 'text' : 'password'}
        autoComplete="new-password"
        spellCheck={false}
        maxLength={12}
        className="flex-1 font-mono tracking-widest uppercase"
        value={value}
        error={invalid}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value.replace(/\s/g, ''))}
      />
      <Button
        type="button"
        size="sm"
        variant="ghost"
        shape="square"
        aria-label={visible ? t('access.hide') : t('access.show')}
        title={visible ? t('access.hide') : t('access.show')}
        aria-pressed={visible}
        onClick={() => setVisible(!visible)}
      >
        {visible ? <FaEyeSlash /> : <FaEye />}
      </Button>
    </div>
  );
}

export interface AccessCodeSettingsProps {
  workspaceId: string;
  menu: Pick<GuestMenuSummaryDto, 'id' | 'slug' | 'hasAccessCode'>;
  canEdit: boolean;
  onUpdated: (menu: GuestMenuDto) => void;
}

export function AccessCodeSettings({ workspaceId, menu, canEdit, onUpdated }: AccessCodeSettingsProps) {
  const { t } = useTranslation('guestMenu');
  const [code, setCode] = useState('');
  const [editing, setEditing] = useState(!menu.hasAccessCode);
  const [saving, setSaving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [qrError, setQrError] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const codeValid = CODE_PATTERN.test(code);

  const save = async (accessCode: string | null) => {
    setSaving(true);
    try {
      const updated = await updateGuestMenu(workspaceId, menu.id, { accessCode });
      onUpdated(updated);
      alertService.success(accessCode ? t('access.saved') : t('access.removed'));
      // Keep the new code for the QR download of this session (never retrievable later).
      setQrCode(accessCode ?? '');
      setCode('');
      setEditing(accessCode === null);
      setConfirmRemove(false);
    } catch (error) {
      alertApiV1Error(error, t('errors.save'));
    } finally {
      setSaving(false);
    }
  };

  const downloadQr = async () => {
    setDownloading(true);
    setQrError(false);
    try {
      downloadSvg(await fetchGuestMenuQrWithCode(workspaceId, menu.id, qrCode), `${menu.slug}-qr-code.svg`);
    } catch (error) {
      if (error instanceof ApiV1RequestError && error.status === 422) setQrError(true);
      else alertApiV1Error(error, t('access.qrFailed'));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm">
        {menu.hasAccessCode ? <FaLock className="text-warning" /> : <FaLockOpen className="text-base-content/50" />}
        <span className="font-medium">{menu.hasAccessCode ? t('access.statusProtected') : t('access.statusPublic')}</span>
      </div>
      <p className="text-xs text-base-content/60">{t('access.help')}</p>

      {canEdit && editing && (
        <form
          className="flex flex-col gap-1"
          onSubmit={(event) => {
            event.preventDefault();
            if (codeValid) void save(code);
          }}
        >
          <label htmlFor={`gm-access-code-${menu.id}`} className="text-sm font-medium">
            {menu.hasAccessCode ? t('access.newCode') : t('access.code')}
          </label>
          <CodeInput id={`gm-access-code-${menu.id}`} value={code} onChange={setCode} invalid={code !== '' && !codeValid} />
          <span className={code !== '' && !codeValid ? 'text-xs text-error' : 'text-xs text-base-content/60'}>{t('access.codeRules')}</span>
          <div className="flex justify-end gap-2">
            {menu.hasAccessCode && (
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
                {t('access.cancel')}
              </Button>
            )}
            <Button type="submit" size="sm" variant="primary" loading={saving} disabled={!codeValid}>
              {menu.hasAccessCode ? t('access.change') : t('access.enable')}
            </Button>
          </div>
        </form>
      )}

      {canEdit && menu.hasAccessCode && !editing && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
            {t('access.changeCode')}
          </Button>
          {confirmRemove ? (
            <>
              <Button type="button" size="sm" variant="error" loading={saving} onClick={() => save(null)}>
                {t('access.removeConfirm')}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmRemove(false)}>
                {t('access.cancel')}
              </Button>
            </>
          ) : (
            <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmRemove(true)}>
              {t('access.remove')}
            </Button>
          )}
        </div>
      )}

      {menu.hasAccessCode && (
        <div className="flex flex-col gap-1 rounded-md border border-base-300 p-2">
          <label htmlFor={`gm-access-qr-${menu.id}`} className="text-sm font-medium">
            {t('access.qrTitle')}
          </label>
          <p className="text-xs text-base-content/60">{t('access.qrHelp')}</p>
          <CodeInput
            id={`gm-access-qr-${menu.id}`}
            value={qrCode}
            onChange={(value) => {
              setQrCode(value);
              setQrError(false);
            }}
            invalid={qrError}
          />
          {qrError && <span className="text-xs text-error">{t('access.qrMismatch')}</span>}
          <div className="flex justify-end">
            <Button type="button" size="sm" variant="outline" loading={downloading} disabled={!CODE_PATTERN.test(qrCode)} onClick={downloadQr}>
              <FaDownload /> {t('access.qrDownload')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AccessCodeModal(props: Omit<AccessCodeSettingsProps, 'onUpdated'> & { name: string; onUpdated: () => void }) {
  const { t } = useTranslation('guestMenu');
  const modalContext = useContext(ModalContext);
  const [menu, setMenu] = useState(props.menu);
  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      <h2 className="text-2xl font-bold">{t('access.modalTitle', { name: props.name })}</h2>
      <AccessCodeSettings
        workspaceId={props.workspaceId}
        menu={menu}
        canEdit={props.canEdit}
        onUpdated={(updated) => {
          setMenu(updated);
          props.onUpdated();
        }}
      />
      <div className="flex justify-end">
        <Button type="button" variant="outline" onClick={() => modalContext.closeModal()}>
          {t('access.close')}
        </Button>
      </div>
    </div>
  );
}
