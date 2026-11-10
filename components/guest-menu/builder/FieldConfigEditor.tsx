/**
 * Editor for a (partial) `FieldConfig` layer. With `inherited`, every field can
 * be left on "inherit" (undefined) and shows the effective value; without it
 * the editor edits the full base config (`defaults.fields`).
 */
import { useTranslation } from 'react-i18next';
import { Alert, Select } from '@components/ui';
import {
  ADDITIVE_DISPLAYS,
  ALCOHOL_DISPLAYS,
  ALLERGEN_DISPLAYS,
  type AdditiveDisplay,
  type AlcoholDisplay,
  type AllergenDisplay,
  FIELD_KEYS,
  FIELD_MODES,
  type FieldConfig,
  type FieldKey,
  type FieldMode,
  type GuestMenuOutput,
  type PartialFieldConfig,
} from '@lib/guest-menu/schema';
import { InheritBadge } from './controls';

const INHERIT = '__inherit';

interface FieldConfigEditorProps {
  value: PartialFieldConfig;
  /** Effective values of the parent layer; `null` = base layer (no inheritance). */
  inherited: FieldConfig | null;
  onChange: (value: PartialFieldConfig) => void;
  /** Output the effective modes are explained for (monitor/print have no detail view). */
  output?: GuestMenuOutput | null;
  disabled?: boolean;
  idPrefix: string;
}

const DISPLAY_OPTIONS = {
  alcoholDisplay: ALCOHOL_DISPLAYS,
  allergenDisplay: ALLERGEN_DISPLAYS,
  additiveDisplay: ADDITIVE_DISPLAYS,
} as const;
type DisplayKey = keyof typeof DISPLAY_OPTIONS;
type DisplayLabelKey =
  | `builder.fields.displays.alcoholDisplay.${AlcoholDisplay}`
  | `builder.fields.displays.allergenDisplay.${AllergenDisplay}`
  | `builder.fields.displays.additiveDisplay.${AdditiveDisplay}`;

function isDisplayKey(key: keyof FieldConfig): key is DisplayKey {
  return key in DISPLAY_OPTIONS;
}

export function FieldConfigEditor({ value, inherited, onChange, output, disabled, idPrefix }: FieldConfigEditorProps) {
  const { t } = useTranslation('guestMenu');

  const set = (key: keyof FieldConfig, next: string) => {
    const copy: Record<string, unknown> = { ...value };
    if (next === INHERIT) delete copy[key];
    else copy[key] = next;
    onChange(copy as PartialFieldConfig);
  };

  const effective = (key: keyof FieldConfig) => (value[key] ?? inherited?.[key]) as string | undefined;
  const amountsOn = effective('amounts') !== undefined && effective('amounts') !== 'off';
  const staticOutput = output === 'monitor' || output === 'print';

  const renderSelect = (key: keyof FieldConfig, options: readonly string[], labelFor: (option: string) => string) => {
    const own = value[key] as string | undefined;
    const id = `${idPrefix}-${key}`;
    return (
      <div key={key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,11rem)] items-center gap-2 py-1">
        <div className="flex min-w-0 flex-col">
          <label htmlFor={id} className="truncate text-sm">
            {isDisplayKey(key) ? t(`builder.fields.${key}`) : t(`fields.${key as FieldKey}`)}
          </label>
          {inherited && <InheritBadge overridden={own !== undefined} onReset={own !== undefined && !disabled ? () => set(key, INHERIT) : undefined} />}
        </div>
        <Select id={id} selectSize="sm" value={own ?? INHERIT} disabled={disabled} onChange={(event) => set(key, event.target.value)}>
          {inherited && <option value={INHERIT}>{t('builder.fields.inheritValue', { value: labelFor(String(inherited[key])) })}</option>}
          {options.map((option) => (
            <option key={option} value={option}>
              {labelFor(option)}
            </option>
          ))}
        </Select>
      </div>
    );
  };

  const modeLabel = (mode: string) => t(`fieldModes.${mode as FieldMode}`);

  return (
    <div className="flex flex-col">
      {staticOutput && <p className="pb-2 text-xs text-base-content/60">{t('builder.fields.staticOutputHint')}</p>}
      {FIELD_KEYS.map((key: FieldKey) => renderSelect(key, FIELD_MODES, modeLabel))}
      {amountsOn && (
        <Alert variant="warning" className="my-2 text-xs">
          {t('builder.fields.amountsWarning')}
        </Alert>
      )}
      <div className="mt-2 border-t border-base-300 pt-2">
        {(Object.keys(DISPLAY_OPTIONS) as DisplayKey[]).map((key) =>
          renderSelect(key, DISPLAY_OPTIONS[key], (option) => t(`builder.fields.displays.${key}.${option}` as DisplayLabelKey)),
        )}
      </div>
    </div>
  );
}
