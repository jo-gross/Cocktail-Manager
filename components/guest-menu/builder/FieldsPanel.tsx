/** "Informationen" tab: base field config (`defaults.fields`) and per-output overrides. */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GUEST_MENU_OUTPUTS, type FieldConfig, type GuestMenuOutput } from '@lib/guest-menu/schema';
import { useBuilder } from './BuilderContext';
import { OUTPUT_ICONS, PanelSection, Segmented } from './controls';
import { FieldConfigEditor } from './FieldConfigEditor';

type Layer = 'defaults' | GuestMenuOutput;

export function FieldsPanel() {
  const { t } = useTranslation('guestMenu');
  const { document, update, output, canEdit } = useBuilder();
  const [layer, setLayer] = useState<Layer>(output);

  return (
    <PanelSection title={t('builder.fields.title')}>
      <p className="text-xs text-base-content/60">{t('builder.fields.inheritanceHint')}</p>
      <Segmented<Layer>
        value={layer}
        onChange={setLayer}
        size="xs"
        ariaLabel={t('builder.fields.layer')}
        options={[
          { value: 'defaults', label: t('builder.fields.defaults') },
          ...GUEST_MENU_OUTPUTS.map((entry) => ({
            value: entry as Layer,
            label: (
              <>
                {OUTPUT_ICONS[entry]} {t(`outputs.${entry}`)}
              </>
            ),
          })),
        ]}
      />
      {layer === 'defaults' ? (
        <FieldConfigEditor
          idPrefix="gm-fields-defaults"
          value={document.defaults.fields}
          inherited={null}
          disabled={!canEdit}
          onChange={(fields) => update((doc) => ({ ...doc, defaults: { fields: { ...doc.defaults.fields, ...fields } as FieldConfig } }))}
        />
      ) : (
        <FieldConfigEditor
          idPrefix={`gm-fields-${layer}`}
          value={document.outputs[layer].fields}
          inherited={document.defaults.fields}
          output={layer}
          disabled={!canEdit}
          onChange={(fields) => update((doc) => ({ ...doc, outputs: { ...doc.outputs, [layer]: { ...doc.outputs[layer], fields } } }))}
        />
      )}
    </PanelSection>
  );
}
