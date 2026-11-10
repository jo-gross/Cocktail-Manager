/** "Zeitplan & Quelle" tab: menu meta data (PATCH, takes effect without publishing) and guest access code. */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Checkbox, cn, Input, Select, Toggle } from '@components/ui';
import { alertService } from '@lib/alertService';
import { ApiV1RequestError, alertApiV1Error } from '@lib/network/apiV1';
import { updateGuestMenu } from '@lib/network/guestMenus';
import { getAllContentLocales } from '@lib/workspace/workspaceLocaleSettings';
import type { GuestMenuDto, GuestMenuUpdateInput } from '@lib/schemas/guestMenus';
import { AccessCodeSettings } from '@components/guest-menu/manage/AccessCodeSettings';
import { useBuilder } from './BuilderContext';
import { FieldRow, PanelSection, useLanguageName } from './controls';

type MetaForm = Required<Pick<GuestMenuUpdateInput, 'name' | 'slug' | 'enabled' | 'isDefault' | 'weekdays' | 'inactiveBehavior' | 'sourceMode' | 'locales'>> & {
  validFrom: string;
  validTo: string;
  timeFrom: string;
  timeTo: string;
  sourceCardId: string;
};

function toForm(menu: GuestMenuDto): MetaForm {
  return {
    name: menu.name,
    slug: menu.slug,
    enabled: menu.enabled,
    isDefault: menu.isDefault,
    validFrom: menu.validFrom ?? '',
    validTo: menu.validTo ?? '',
    weekdays: [...menu.weekdays],
    timeFrom: menu.timeFrom ?? '',
    timeTo: menu.timeTo ?? '',
    inactiveBehavior: menu.inactiveBehavior,
    sourceMode: menu.sourceMode,
    sourceCardId: menu.sourceCardId ?? '',
    locales: [...menu.locales],
  };
}

function toInput(form: MetaForm): GuestMenuUpdateInput {
  return {
    name: form.name.trim(),
    slug: form.slug.trim(),
    enabled: form.enabled,
    isDefault: form.isDefault,
    validFrom: form.validFrom || null,
    validTo: form.validTo || null,
    weekdays: [...form.weekdays].sort((a, b) => a - b),
    timeFrom: form.timeFrom || null,
    timeTo: form.timeTo || null,
    inactiveBehavior: form.inactiveBehavior,
    sourceMode: form.sourceMode,
    sourceCardId: form.sourceMode === 'FIXED_CARD' ? form.sourceCardId || null : null,
    locales: form.locales,
  };
}

/** Monday-first weekday order with localized short names. */
export function useWeekdayNames(): { day: number; label: string }[] {
  const { i18n } = useTranslation();
  return useMemo(() => {
    const formatter = new Intl.DateTimeFormat(i18n.language || 'de', { weekday: 'short', timeZone: 'UTC' });
    // 2026-11-01 is a Sunday.
    return [1, 2, 3, 4, 5, 6, 0].map((day) => ({ day, label: formatter.format(new Date(Date.UTC(2026, 10, 1 + day))) }));
  }, [i18n.language]);
}

export function SchedulePanel() {
  const { t } = useTranslation('guestMenu');
  const { menu, setMenu, workspaceId, data, canEdit } = useBuilder();
  const languageName = useLanguageName();
  const weekdays = useWeekdayNames();
  const [form, setForm] = useState<MetaForm>(() => toForm(menu));
  const [saving, setSaving] = useState(false);
  const [slugError, setSlugError] = useState(false);

  // Reset the form when the stored meta data changes (not on every draft autosave).
  const metaKey = JSON.stringify(toInput(toForm(menu)));
  const [formMetaKey, setFormMetaKey] = useState(metaKey);
  if (formMetaKey !== metaKey) {
    setFormMetaKey(metaKey);
    setForm(toForm(menu));
  }

  const dirty = JSON.stringify(toInput(form)) !== metaKey;
  const set = (patch: Partial<MetaForm>) => setForm((current) => ({ ...current, ...patch }));
  const workspaceLocales = data.localeSettings ? getAllContentLocales(data.localeSettings.contentLocales) : menu.locales;
  const invalidRange = form.validFrom !== '' && form.validTo !== '' && form.validFrom > form.validTo;
  const slugValid = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug.trim());

  const save = async () => {
    setSaving(true);
    setSlugError(false);
    try {
      const updated = await updateGuestMenu(workspaceId, menu.id, toInput(form));
      setMenu({ ...updated, draft: menu.draft });
      alertService.success(t('builder.schedule.saved'));
    } catch (error) {
      if (error instanceof ApiV1RequestError && error.status === 409) setSlugError(true);
      else alertApiV1Error(error, t('errors.save'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PanelSection title={t('builder.schedule.general')}>
        <FieldRow label={t('name')} htmlFor="gm-meta-name">
          <Input id="gm-meta-name" inputSize="sm" value={form.name} disabled={!canEdit} onChange={(event) => set({ name: event.target.value })} />
        </FieldRow>
        <FieldRow label={t('slug')} htmlFor="gm-meta-slug" hint={t('slugHelp', { bar: '…', slug: form.slug || '…' })}>
          <Input
            id="gm-meta-slug"
            inputSize="sm"
            value={form.slug}
            error={slugError || !slugValid}
            disabled={!canEdit}
            onChange={(event) => set({ slug: event.target.value.toLowerCase() })}
          />
        </FieldRow>
        {slugError && <p className="text-xs text-error">{t('errors.slugTaken')}</p>}
        <label className="flex items-center justify-between gap-3 text-sm">
          {t('enabled')}
          <Toggle toggleSize="sm" checked={form.enabled} disabled={!canEdit} onChange={(event) => set({ enabled: event.target.checked })} />
        </label>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="flex flex-col">
            {t('isDefault')}
            <span className="text-xs text-base-content/60">{t('isDefaultHelp')}</span>
          </span>
          <Toggle toggleSize="sm" checked={form.isDefault} disabled={!canEdit} onChange={(event) => set({ isDefault: event.target.checked })} />
        </label>
      </PanelSection>

      <PanelSection title={t('schedule.title')}>
        <div className="grid grid-cols-2 gap-2">
          <FieldRow label={t('schedule.validFrom')} htmlFor="gm-meta-valid-from">
            <Input
              id="gm-meta-valid-from"
              type="date"
              inputSize="sm"
              value={form.validFrom}
              disabled={!canEdit}
              onChange={(event) => set({ validFrom: event.target.value })}
            />
          </FieldRow>
          <FieldRow label={t('schedule.validTo')} htmlFor="gm-meta-valid-to">
            <Input
              id="gm-meta-valid-to"
              type="date"
              inputSize="sm"
              value={form.validTo}
              error={invalidRange}
              disabled={!canEdit}
              onChange={(event) => set({ validTo: event.target.value })}
            />
          </FieldRow>
        </div>
        {invalidRange && <p className="text-xs text-error">{t('builder.schedule.invalidRange')}</p>}
        <FieldRow label={t('schedule.weekdays')} hint={form.weekdays.length === 0 ? t('schedule.allWeekdays') : undefined}>
          <div className="flex flex-wrap gap-1">
            {weekdays.map(({ day, label }) => {
              const active = form.weekdays.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={active}
                  disabled={!canEdit}
                  onClick={() => set({ weekdays: active ? form.weekdays.filter((entry) => entry !== day) : [...form.weekdays, day] })}
                  className={cn(
                    'h-8 min-w-10 rounded-md border px-2 text-xs font-medium',
                    active ? 'border-primary bg-primary text-primary-content' : 'border-base-300 hover:bg-base-200',
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </FieldRow>
        <div className="grid grid-cols-2 gap-2">
          <FieldRow label={t('schedule.timeFrom')} htmlFor="gm-meta-time-from">
            <Input
              id="gm-meta-time-from"
              type="time"
              inputSize="sm"
              value={form.timeFrom}
              disabled={!canEdit}
              onChange={(event) => set({ timeFrom: event.target.value })}
            />
          </FieldRow>
          <FieldRow label={t('schedule.timeTo')} htmlFor="gm-meta-time-to">
            <Input
              id="gm-meta-time-to"
              type="time"
              inputSize="sm"
              value={form.timeTo}
              disabled={!canEdit}
              onChange={(event) => set({ timeTo: event.target.value })}
            />
          </FieldRow>
        </div>
        <p className="text-xs text-base-content/60">{t('schedule.timeHelp')}</p>
        <FieldRow label={t('inactiveBehavior.title')} htmlFor="gm-meta-inactive">
          <Select
            id="gm-meta-inactive"
            selectSize="sm"
            value={form.inactiveBehavior}
            disabled={!canEdit}
            onChange={(event) => set({ inactiveBehavior: event.target.value as MetaForm['inactiveBehavior'] })}
          >
            {(['NOTICE_WITH_LINK', 'NOTICE_WITH_CONTENT', 'REDIRECT'] as const).map((value) => (
              <option key={value} value={value}>
                {t(`inactiveBehavior.${value}`)}
              </option>
            ))}
          </Select>
        </FieldRow>
      </PanelSection>

      <PanelSection title={t('source.title')}>
        <FieldRow label={t('source.title')} htmlFor="gm-meta-source">
          <Select
            id="gm-meta-source"
            selectSize="sm"
            value={form.sourceMode}
            disabled={!canEdit}
            onChange={(event) => set({ sourceMode: event.target.value as MetaForm['sourceMode'] })}
          >
            {(['ACTIVE_CARD', 'FIXED_CARD', 'NONE'] as const).map((value) => (
              <option key={value} value={value}>
                {t(`source.${value}`)}
              </option>
            ))}
          </Select>
        </FieldRow>
        {form.sourceMode === 'FIXED_CARD' && (
          <FieldRow label={t('source.card')} htmlFor="gm-meta-card">
            <Select
              id="gm-meta-card"
              selectSize="sm"
              value={form.sourceCardId}
              disabled={!canEdit}
              onChange={(event) => set({ sourceCardId: event.target.value })}
            >
              <option value="">{t('builder.schedule.chooseCard')}</option>
              {data.cards.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.name}
                </option>
              ))}
            </Select>
          </FieldRow>
        )}
        <p className="text-xs text-base-content/60">{t(`builder.schedule.sourceHint.${form.sourceMode}`)}</p>
      </PanelSection>

      <PanelSection title={t('access.title')}>
        {/* Saved on its own (not part of the meta form): the code is never loaded back. */}
        <AccessCodeSettings workspaceId={workspaceId} menu={menu} canEdit={canEdit} onUpdated={(updated) => setMenu({ ...updated, draft: menu.draft })} />
      </PanelSection>

      <PanelSection title={t('locales')}>
        <p className="text-xs text-base-content/60">{t('localesHelp')}</p>
        {workspaceLocales.map((locale) => (
          <label key={locale} className="flex items-center gap-2 text-sm">
            <Checkbox
              checkboxSize="sm"
              checked={form.locales.includes(locale)}
              disabled={!canEdit}
              onChange={(event) => set({ locales: event.target.checked ? [...form.locales, locale] : form.locales.filter((entry) => entry !== locale) })}
            />
            {languageName(locale)}
          </label>
        ))}
      </PanelSection>

      {canEdit && (
        <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-base-300 bg-base-100 p-3">
          {dirty && <span className="mr-auto text-xs text-warning">{t('builder.schedule.unsaved')}</span>}
          <Button type="button" size="sm" variant="ghost" disabled={!dirty || saving} onClick={() => setForm(toForm(menu))}>
            {t('builder.schedule.discard')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="primary"
            loading={saving}
            disabled={!dirty || invalidRange || !slugValid || !form.name.trim()}
            onClick={save}
          >
            {t('builder.schedule.save')}
          </Button>
        </div>
      )}
      {!canEdit && <Alert variant="info">{t('builder.readOnly')}</Alert>}
    </>
  );
}
