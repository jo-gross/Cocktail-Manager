/** "Design" tab: template per output, theme tokens (colors with WCAG check, fonts, radius, density), logo/background, price format. */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { FaCheck, FaExclamationTriangle } from 'react-icons/fa';
import { Button, Checkbox, cn, Input, Select } from '@components/ui';
import { checkThemeContrast } from '@lib/guest-menu/builder';
import { formatMoney } from '@lib/guest-menu/format';
import {
  GUEST_MENU_FONTS,
  GUEST_MENU_OUTPUTS,
  THEME_DENSITIES,
  type GuestMenuTheme,
  type ThemeColors,
  type ThemeDensity,
  type ThemeTokens,
} from '@lib/guest-menu/schema';
import { getFontStack } from '@lib/guest-menu/theme';
import { listBuiltInTemplates } from '@lib/guest-menu/templates';
import { useBuilder } from './BuilderContext';
import { FieldRow, ImagePicker, PanelSection, Segmented } from './controls';
import { TemplateThumbnail } from './TemplateThumbnail';

const COLOR_KEYS: (keyof ThemeColors)[] = ['bg', 'surface', 'text', 'muted', 'accent', 'accentContrast'];
const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

function ColorField({
  id,
  label,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(value);
  }
  const sixDigit = /^#[0-9a-f]{6}$/i.test(value) ? value : /^#[0-9a-f]{3}$/i.test(value) ? `#${value.slice(1).replace(/./g, (c) => c + c)}` : value.slice(0, 7);
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        aria-label={label}
        value={sixDigit}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 w-10 shrink-0 cursor-pointer rounded border border-base-300 bg-transparent"
      />
      <label htmlFor={id} className="min-w-0 flex-1 truncate text-sm">
        {label}
      </label>
      <Input
        id={id}
        inputSize="sm"
        className={cn('w-24 font-mono text-xs', !HEX.test(draft) && 'border-error')}
        value={draft}
        disabled={disabled}
        onChange={(event) => {
          setDraft(event.target.value);
          if (HEX.test(event.target.value)) onChange(event.target.value);
        }}
      />
    </div>
  );
}

export function DesignPanel() {
  const { t } = useTranslation('guestMenu');
  const { document, update, output, data, canEdit, workspaceId, locale } = useBuilder();
  const [applyToAll, setApplyToAll] = useState(false);
  const theme = document.theme;
  const tokens = theme.tokens;

  const builtIns = useMemo(() => listBuiltInTemplates(), []);
  const currentTemplateId = document.templates[output].templateId;
  const contrast = useMemo(() => checkThemeContrast(tokens.colors), [tokens.colors]);

  const setTheme = (patch: Partial<GuestMenuTheme>, mergeKey?: string) => update((doc) => ({ ...doc, theme: { ...doc.theme, ...patch } }), mergeKey);
  const setTokens = (patch: Partial<ThemeTokens>, mergeKey?: string) =>
    update((doc) => ({ ...doc, theme: { ...doc.theme, tokens: { ...doc.theme.tokens, ...patch } } }), mergeKey);

  const chooseTemplate = (templateId: string, supported: readonly string[]) => {
    update((doc) => {
      const templates = { ...doc.templates };
      for (const target of GUEST_MENU_OUTPUTS) {
        if (target === output || (applyToAll && supported.includes(target))) templates[target] = { ...templates[target], templateId };
      }
      return { ...doc, templates };
    });
  };

  const selectedBuiltIn = builtIns.find((template) => template.id === currentTemplateId);
  const hasSlotOverrides = Object.values(document.templates[output].slots ?? {}).some((value) => !!value?.trim());
  const currency = data.localeSettings?.currency ?? 'EUR';

  return (
    <>
      <PanelSection title={t('builder.design.template', { output: t(`outputs.${output}`) })}>
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
          {builtIns
            .filter((template) => template.outputs.includes(output))
            .map((template) => (
              <TemplateThumbnail
                key={template.id}
                template={{ ...template, tokens: template.defaultTokens }}
                selected={currentTemplateId === template.id}
                disabled={!canEdit}
                onClick={() => chooseTemplate(template.id, template.outputs)}
              />
            ))}
          {data.customTemplates.map((template) => {
            const base = builtIns.find((entry) => entry.id === template.definition.baseTemplateId);
            return (
              <TemplateThumbnail
                key={template.id}
                template={{
                  id: template.templateId,
                  name: template.name,
                  layout: base?.layout ?? 'list',
                  tokens: template.definition.theme?.tokens ?? base?.defaultTokens ?? tokens,
                }}
                selected={currentTemplateId === template.templateId}
                disabled={!canEdit}
                onClick={() => chooseTemplate(template.templateId, GUEST_MENU_OUTPUTS)}
              />
            );
          })}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checkboxSize="sm" checked={applyToAll} onChange={(event) => setApplyToAll(event.target.checked)} />
          {t('builder.design.applyToAllOutputs')}
        </label>
        {hasSlotOverrides && <p className="text-xs text-warning">{t('builder.design.slotOverridesHint')}</p>}
        {selectedBuiltIn && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!canEdit}
            onClick={() => setTheme({ preset: selectedBuiltIn.id, tokens: structuredClone(selectedBuiltIn.defaultTokens) })}
          >
            {t('builder.design.applyTemplateTheme')}
          </Button>
        )}
      </PanelSection>

      <PanelSection title={t('builder.design.colors')}>
        {COLOR_KEYS.map((key) => (
          <ColorField
            key={key}
            id={`gm-color-${key}`}
            label={t(`builder.design.colorNames.${key}`)}
            value={tokens.colors[key]}
            disabled={!canEdit}
            onChange={(value) => setTokens({ colors: { ...tokens.colors, [key]: value } }, `color-${key}`)}
          />
        ))}
        <ul className="mt-1 flex flex-col gap-1 rounded-lg bg-base-200 p-2 text-xs">
          {contrast.map((check) => (
            <li key={check.id} className={cn('flex items-center gap-2', !check.ok && 'font-semibold text-warning')}>
              {check.ok ? <FaCheck className="text-success" /> : <FaExclamationTriangle />}
              <span className="flex-1">{t(`builder.design.contrast.${check.id}`)}</span>
              <span className="font-mono">{t('builder.design.contrast.ratio', { ratio: check.ratio?.toFixed(1) ?? '–', minimum: check.minimum })}</span>
            </li>
          ))}
        </ul>
      </PanelSection>

      <PanelSection title={t('builder.design.typography')}>
        {(['fontHeading', 'fontBody'] as const).map((key) => (
          <FieldRow key={key} label={t(`builder.design.${key}`)} htmlFor={`gm-${key}`}>
            <Select
              id={`gm-${key}`}
              selectSize="sm"
              value={tokens[key]}
              disabled={!canEdit}
              style={{ fontFamily: getFontStack(tokens[key]) }}
              onChange={(event) => setTokens({ [key]: event.target.value } as Partial<ThemeTokens>)}
            >
              {GUEST_MENU_FONTS.map((font) => (
                <option key={font.id} value={font.id} style={{ fontFamily: font.css }}>
                  {font.label}
                </option>
              ))}
            </Select>
          </FieldRow>
        ))}
        <FieldRow label={t('builder.design.radius', { value: tokens.radius })} htmlFor="gm-radius">
          <input
            id="gm-radius"
            type="range"
            min={0}
            max={32}
            value={tokens.radius}
            disabled={!canEdit}
            className="w-full accent-primary"
            onChange={(event) => setTokens({ radius: Number(event.target.value) }, 'radius')}
          />
        </FieldRow>
        <FieldRow label={t('builder.design.density')}>
          <Segmented<ThemeDensity>
            value={tokens.density}
            ariaLabel={t('builder.design.density')}
            onChange={(density) => canEdit && setTokens({ density })}
            options={THEME_DENSITIES.map((density) => ({ value: density, label: t(`builder.design.densities.${density}`) }))}
          />
        </FieldRow>
      </PanelSection>

      <PanelSection title={t('builder.design.images')}>
        <ImagePicker label={t('builder.design.logo')} value={theme.logo} maxEdge={800} onChange={(logo) => setTheme({ logo })} />
        <p className="text-xs text-base-content/60">{t('builder.design.logoHint')}</p>
        <ImagePicker
          label={t('builder.design.background')}
          value={theme.backgroundImage}
          maxEdge={2000}
          onChange={(backgroundImage) => setTheme({ backgroundImage })}
        />
      </PanelSection>

      <PanelSection title={t('builder.design.priceFormat')}>
        <p className="text-sm">{t('builder.design.priceExample', { example: formatMoney(12.5, locale, currency), currency })}</p>
        <Link href={`/workspaces/${workspaceId}/manage/settings`} className="link text-xs">
          {t('builder.design.priceSettingsLink')}
        </Link>
      </PanelSection>
    </>
  );
}
