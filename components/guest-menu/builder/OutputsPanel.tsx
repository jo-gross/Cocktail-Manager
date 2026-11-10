/** "Ausgaben" tab: web search/filters, monitor and print options. */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Checkbox, Input, Select, Toggle } from '@components/ui';
import { resolveLocalizedText } from '@lib/guest-menu/localizedText';
import {
  LAYOUTS,
  layoutsForOutput,
  MONITOR_LOCALE_MODES,
  PRINT_PAPERS,
  WEB_SORTS,
  type GuestMenuOutput,
  type GuestMenuOutputs,
  type MonitorOutput,
  type PrintOutput,
  type WebOutput,
} from '@lib/guest-menu/schema';
import { useBuilder } from './BuilderContext';
import { FieldRow, LocalizedInput, PanelSection, useLanguageName } from './controls';
import { CustomFiltersEditor } from './CustomFiltersEditor';

function SwitchRow({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: ReactNode;
  hint?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-start justify-between gap-3 py-1">
      <span className="flex flex-col">
        <span className="text-sm">{label}</span>
        {hint && <span className="text-xs text-base-content/60">{hint}</span>}
      </span>
      <Toggle toggleSize="sm" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

export function OutputsPanel() {
  const { t } = useTranslation('guestMenu');
  const { document, update, canEdit, locales, data, primaryLocale } = useBuilder();
  const languageName = useLanguageName();
  const { web, monitor, print } = document.outputs;

  const set = <K extends keyof GuestMenuOutputs>(key: K, patch: Partial<GuestMenuOutputs[K]>, mergeKey?: string) =>
    update((doc) => ({ ...doc, outputs: { ...doc.outputs, [key]: { ...doc.outputs[key], ...patch } } }), mergeKey);
  const setWeb = (patch: Partial<WebOutput>, mergeKey?: string) => set('web', patch, mergeKey);
  const setMonitor = (patch: Partial<MonitorOutput>, mergeKey?: string) => set('monitor', patch, mergeKey);
  const setPrint = (patch: Partial<PrintOutput>) => set('print', patch);

  const layoutSelect = (id: string, output: GuestMenuOutput, value: string, onChange: (value: (typeof LAYOUTS)[number]) => void) => (
    <FieldRow label={t('builder.outputs.layout')} htmlFor={id}>
      <Select id={id} selectSize="sm" value={value} disabled={!canEdit} onChange={(event) => onChange(event.target.value as (typeof LAYOUTS)[number])}>
        {layoutsForOutput(output).map((layout) => (
          <option key={layout} value={layout}>
            {t(`builder.layouts.${layout}`)}
          </option>
        ))}
      </Select>
    </FieldRow>
  );

  const localeOptions = locales.map((locale) => (
    <option key={locale} value={locale}>
      {languageName(locale)}
    </option>
  ));

  const categories = web.filters.categories;
  const filterCategories = data.tagCategories.filter((category) => category.tagCount > 0);

  return (
    <>
      <PanelSection title={t('outputs.web')}>
        <SwitchRow label={t('builder.outputs.enabled')} checked={web.enabled} disabled={!canEdit} onChange={(enabled) => setWeb({ enabled })} />
        {layoutSelect('gm-web-layout', 'web', web.layout, (layout) => setWeb({ layout }))}
        <FieldRow label={t('builder.outputs.sort')} htmlFor="gm-web-sort">
          <Select
            id="gm-web-sort"
            selectSize="sm"
            value={web.sort}
            disabled={!canEdit}
            onChange={(event) => setWeb({ sort: event.target.value as WebOutput['sort'] })}
          >
            {WEB_SORTS.map((sort) => (
              <option key={sort} value={sort}>
                {t(`builder.outputs.sorts.${sort}`)}
              </option>
            ))}
          </Select>
        </FieldRow>
        <SwitchRow
          label={t('builder.outputs.search')}
          checked={web.search.enabled}
          disabled={!canEdit}
          onChange={(enabled) => setWeb({ search: { ...web.search, enabled } })}
        />
        <SwitchRow
          label={t('builder.outputs.ingredientsSearchable')}
          checked={web.search.ingredientsSearchable}
          disabled={!canEdit || !web.search.enabled}
          onChange={(ingredientsSearchable) => setWeb({ search: { ...web.search, ingredientsSearchable } })}
        />
        <SwitchRow
          label={t('builder.outputs.includeOnRequest')}
          hint={t('builder.outputs.includeOnRequestHint')}
          checked={web.search.includeOnRequest}
          disabled={!canEdit || !web.search.enabled}
          onChange={(includeOnRequest) => setWeb({ search: { ...web.search, includeOnRequest } })}
        />
        <FieldRow label={t('builder.customFilters.title')} hint={t('builder.customFilters.hint')}>
          <CustomFiltersEditor value={web.filters.custom ?? []} onChange={(custom, mergeKey) => setWeb({ filters: { ...web.filters, custom } }, mergeKey)} />
        </FieldRow>
        {(web.filters.custom?.length ?? 0) > 0 && (
          <FieldRow label={t('builder.customFilters.sectionTitle')}>
            <LocalizedInput
              value={web.filters.customTitle}
              placeholder={t('builder.customFilters.sectionTitlePlaceholder')}
              onChange={(customTitle) => setWeb({ filters: { ...web.filters, customTitle } }, 'custom-filter-title')}
            />
          </FieldRow>
        )}
        <SwitchRow
          label={t('builder.outputs.allergenFilter')}
          checked={web.filters.allergens}
          disabled={!canEdit}
          onChange={(allergens) => setWeb({ filters: { ...web.filters, allergens } })}
        />
        <SwitchRow
          label={t('builder.outputs.alcoholFilter')}
          checked={web.filters.alcohol}
          disabled={!canEdit}
          onChange={(alcohol) => setWeb({ filters: { ...web.filters, alcohol } })}
        />
        <SwitchRow
          label={t('builder.outputs.autoCategories')}
          hint={t('builder.outputs.autoCategoriesHint')}
          checked={categories === 'auto'}
          disabled={!canEdit}
          onChange={(auto) =>
            setWeb({
              filters: { ...web.filters, categories: auto ? 'auto' : data.tagCategories.filter((category) => category.showAsGuestFilter).map((c) => c.id) },
            })
          }
        />
        {categories !== 'auto' && (
          <div className="flex flex-col gap-1 rounded-lg bg-base-200 p-2">
            {filterCategories.length === 0 && <p className="text-xs text-base-content/60">{t('builder.outputs.noCategories')}</p>}
            {filterCategories.map((category) => (
              <label key={category.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checkboxSize="sm"
                  checked={categories.includes(category.id)}
                  disabled={!canEdit}
                  onChange={(event) =>
                    setWeb({
                      filters: {
                        ...web.filters,
                        categories: event.target.checked ? [...categories, category.id] : categories.filter((id) => id !== category.id),
                      },
                    })
                  }
                />
                {resolveLocalizedText(category.name, primaryLocale, primaryLocale)}
              </label>
            ))}
          </div>
        )}
        <SwitchRow
          label={t('builder.outputs.noindex')}
          hint={t('builder.outputs.noindexHint')}
          checked={web.noindex ?? false}
          disabled={!canEdit}
          onChange={(noindex) => setWeb({ noindex })}
        />
      </PanelSection>

      <PanelSection title={t('outputs.monitor')}>
        <SwitchRow label={t('builder.outputs.enabled')} checked={monitor.enabled} disabled={!canEdit} onChange={(enabled) => setMonitor({ enabled })} />
        {layoutSelect('gm-monitor-layout', 'monitor', monitor.layout, (layout) => setMonitor({ layout }))}
        <FieldRow label={t('builder.outputs.columns')} htmlFor="gm-monitor-columns">
          <Select
            id="gm-monitor-columns"
            selectSize="sm"
            value={String(monitor.columns)}
            disabled={!canEdit}
            onChange={(event) => setMonitor({ columns: event.target.value === 'auto' ? 'auto' : Number(event.target.value) })}
          >
            <option value="auto">{t('builder.outputs.columnsAuto')}</option>
            {[1, 2, 3, 4, 5, 6].map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </Select>
        </FieldRow>
        <FieldRow label={t('builder.outputs.pageDuration')} htmlFor="gm-monitor-duration">
          <Input
            id="gm-monitor-duration"
            type="number"
            inputSize="sm"
            min={3}
            max={600}
            value={monitor.pageDurationSeconds}
            disabled={!canEdit}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (Number.isFinite(value)) setMonitor({ pageDurationSeconds: Math.min(600, Math.max(3, Math.round(value))) }, 'monitor-duration');
            }}
          />
        </FieldRow>
        <SwitchRow label={t('builder.outputs.showQr')} checked={monitor.showQrCode} disabled={!canEdit} onChange={(showQrCode) => setMonitor({ showQrCode })} />
        <FieldRow label={t('builder.outputs.localeMode')} htmlFor="gm-monitor-locale-mode">
          <Select
            id="gm-monitor-locale-mode"
            selectSize="sm"
            value={monitor.localeMode}
            disabled={!canEdit}
            onChange={(event) => setMonitor({ localeMode: event.target.value as MonitorOutput['localeMode'] })}
          >
            {MONITOR_LOCALE_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {t(`builder.outputs.localeModes.${mode}`)}
              </option>
            ))}
          </Select>
        </FieldRow>
        {monitor.localeMode === 'fixed' && (
          <FieldRow label={t('builder.outputs.locale')} htmlFor="gm-monitor-locale">
            <Select
              id="gm-monitor-locale"
              selectSize="sm"
              value={monitor.locale ?? primaryLocale}
              disabled={!canEdit}
              onChange={(event) => setMonitor({ locale: event.target.value })}
            >
              {localeOptions}
            </Select>
          </FieldRow>
        )}
      </PanelSection>

      <PanelSection title={t('outputs.print')}>
        <SwitchRow label={t('builder.outputs.enabled')} checked={print.enabled} disabled={!canEdit} onChange={(enabled) => setPrint({ enabled })} />
        {layoutSelect('gm-print-layout', 'print', print.layout, (layout) => setPrint({ layout }))}
        <FieldRow label={t('builder.outputs.paper')} htmlFor="gm-print-paper">
          <Select
            id="gm-print-paper"
            selectSize="sm"
            value={print.paper}
            disabled={!canEdit}
            onChange={(event) => setPrint({ paper: event.target.value as PrintOutput['paper'] })}
          >
            {PRINT_PAPERS.map((paper) => (
              <option key={paper} value={paper}>
                {t(`builder.outputs.papers.${paper}`)}
              </option>
            ))}
          </Select>
        </FieldRow>
        <FieldRow label={t('builder.outputs.locale')} htmlFor="gm-print-locale">
          <Select
            id="gm-print-locale"
            selectSize="sm"
            value={print.locale ?? ''}
            disabled={!canEdit}
            onChange={(event) => setPrint({ locale: event.target.value === '' ? null : event.target.value })}
          >
            <option value="">{t('builder.outputs.primaryLocale')}</option>
            {localeOptions}
          </Select>
        </FieldRow>
        <SwitchRow label={t('builder.outputs.showQr')} checked={print.showQrCode} disabled={!canEdit} onChange={(showQrCode) => setPrint({ showQrCode })} />
      </PanelSection>
    </>
  );
}
