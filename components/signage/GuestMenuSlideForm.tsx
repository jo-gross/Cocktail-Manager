import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, FormControl, Input, Label, LabelText, LabelTextAlt, Select } from '@components/ui';
import type { GuestMenuSlideOptions } from '@lib/signage/types';

export interface GuestMenuSlideFormMenu {
  id: string;
  name: string;
  isPublished: boolean;
  locales: string[];
}

export interface GuestMenuSlideFormValue {
  guestMenuId: string | null;
  options: GuestMenuSlideOptions;
}

interface GuestMenuSlideFormProps {
  menus: GuestMenuSlideFormMenu[];
  initialValue?: GuestMenuSlideFormValue;
  submitLabel: string;
  onSubmit: (value: GuestMenuSlideFormValue) => Promise<void>;
  onCancel: () => void;
}

const ACTIVE_MENU = '__active__';
const INHERIT = '__inherit__';
const COLUMN_OPTIONS = [1, 2, 3, 4, 5, 6];

/** Menu choice + display overrides for a GUEST_MENU signage slide (create & edit). */
export function GuestMenuSlideForm({ menus, initialValue, submitLabel, onSubmit, onCancel }: GuestMenuSlideFormProps) {
  const { t } = useTranslation('monitor');
  const initialOptions = initialValue?.options ?? {};
  const [guestMenuId, setGuestMenuId] = useState<string>(initialValue?.guestMenuId ?? ACTIVE_MENU);
  const [localeMode, setLocaleMode] = useState<string>(initialOptions.localeMode ?? INHERIT);
  const [locale, setLocale] = useState(initialOptions.locale ?? '');
  const [showQrCode, setShowQrCode] = useState<string>(initialOptions.showQrCode == null ? INHERIT : String(initialOptions.showQrCode));
  const [columns, setColumns] = useState<string>(initialOptions.columns == null ? INHERIT : String(initialOptions.columns));
  const [pageDuration, setPageDuration] = useState(initialOptions.pageDurationSeconds ? String(initialOptions.pageDurationSeconds) : '');
  const [submitting, setSubmitting] = useState(false);

  const localeSuggestions = Array.from(new Set(menus.flatMap((menu) => menu.locales)));

  const handleSubmit = async () => {
    const duration = Number(pageDuration);
    const options: GuestMenuSlideOptions = {
      localeMode: localeMode === INHERIT ? null : (localeMode as GuestMenuSlideOptions['localeMode']),
      locale: localeMode === 'fixed' && locale.trim() ? locale.trim() : null,
      showQrCode: showQrCode === INHERIT ? null : showQrCode === 'true',
      columns: columns === INHERIT ? null : columns === 'auto' ? 'auto' : Number(columns),
      pageDurationSeconds: pageDuration && Number.isFinite(duration) ? Math.min(600, Math.max(3, Math.round(duration))) : null,
    };
    setSubmitting(true);
    try {
      await onSubmit({ guestMenuId: guestMenuId === ACTIVE_MENU ? null : guestMenuId, options });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-base-300/60 bg-base-200/40 p-3">
      <FormControl>
        <Label>
          <LabelText>{t('guestMenuSlide.menu')}</LabelText>
        </Label>
        <Select value={guestMenuId} onChange={(event) => setGuestMenuId(event.target.value)}>
          <option value={ACTIVE_MENU}>{t('guestMenuSlide.activeMenu')}</option>
          {menus.map((menu) => (
            <option key={menu.id} value={menu.id}>
              {menu.isPublished ? menu.name : `${menu.name} (${t('guestMenuSlide.unpublished')})`}
            </option>
          ))}
        </Select>
        <Label>
          <LabelTextAlt>{guestMenuId === ACTIVE_MENU ? t('guestMenuSlide.activeMenuHint') : t('guestMenuSlide.specificMenuHint')}</LabelTextAlt>
        </Label>
      </FormControl>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <FormControl>
          <Label>
            <LabelText>{t('guestMenuSlide.language')}</LabelText>
          </Label>
          <Select value={localeMode} onChange={(event) => setLocaleMode(event.target.value)}>
            <option value={INHERIT}>{t('guestMenuSlide.fromMenu')}</option>
            <option value="primary">{t('guestMenuSlide.languagePrimary')}</option>
            <option value="fixed">{t('guestMenuSlide.languageFixed')}</option>
            <option value="rotate">{t('guestMenuSlide.languageRotate')}</option>
          </Select>
        </FormControl>
        {localeMode === 'fixed' ? (
          <FormControl>
            <Label>
              <LabelText>{t('guestMenuSlide.locale')}</LabelText>
            </Label>
            <Input value={locale} maxLength={16} list="guest-menu-slide-locales" onChange={(event) => setLocale(event.target.value)} />
            <datalist id="guest-menu-slide-locales">
              {localeSuggestions.map((code) => (
                <option key={code} value={code} />
              ))}
            </datalist>
          </FormControl>
        ) : null}
        <FormControl>
          <Label>
            <LabelText>{t('guestMenuSlide.qrCode')}</LabelText>
          </Label>
          <Select value={showQrCode} onChange={(event) => setShowQrCode(event.target.value)}>
            <option value={INHERIT}>{t('guestMenuSlide.fromMenu')}</option>
            <option value="true">{t('guestMenuSlide.show')}</option>
            <option value="false">{t('guestMenuSlide.hide')}</option>
          </Select>
        </FormControl>
        <FormControl>
          <Label>
            <LabelText>{t('guestMenuSlide.columns')}</LabelText>
          </Label>
          <Select value={columns} onChange={(event) => setColumns(event.target.value)}>
            <option value={INHERIT}>{t('guestMenuSlide.fromMenu')}</option>
            <option value="auto">{t('guestMenuSlide.columnsAuto')}</option>
            {COLUMN_OPTIONS.map((count) => (
              <option key={count} value={String(count)}>
                {count}
              </option>
            ))}
          </Select>
        </FormControl>
        <FormControl>
          <Label>
            <LabelText>{t('guestMenuSlide.pageDuration')}</LabelText>
          </Label>
          <Input
            type="number"
            min={3}
            max={600}
            placeholder={t('guestMenuSlide.fromMenu')}
            value={pageDuration}
            onChange={(event) => setPageDuration(event.target.value)}
          />
        </FormControl>
      </div>
      <div className="text-xs text-base-content/60">{t('guestMenuSlide.pageDurationHint')}</div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="primary" size="sm" disabled={submitting} onClick={handleSubmit}>
          {submitLabel}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          {t('close')}
        </Button>
      </div>
    </div>
  );
}
