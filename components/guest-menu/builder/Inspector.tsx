/** Right pane: properties of the selected block (or menu-level texts when nothing is selected). */
import { useTranslation } from 'react-i18next';
import { Select, Toggle } from '@components/ui';
import { LAYOUTS, NOTICE_PRESETS, WEB_ONLY_LAYOUTS, resolveFieldConfig, type Block, type GuestMenuLayout, type NoticePreset } from '@lib/guest-menu/schema';
import { useBuilder } from './BuilderContext';
import { BLOCK_ICONS, getBlockLabel } from './blockLabels';
import { FieldRow, ImagePicker, InheritBadge, LocalizedInput, OutputVisibilityToggles, PanelSection } from './controls';
import { FieldConfigEditor } from './FieldConfigEditor';
import { OverridesEditor } from './OverridesEditor';
import { SectionSourceEditor } from './SectionSourceEditor';

function MenuTexts() {
  const { t } = useTranslation('guestMenu');
  const { document, update } = useBuilder();
  return (
    <PanelSection title={t('builder.inspector.menuTexts')}>
      <FieldRow label={t('builder.inspector.title')}>
        <LocalizedInput value={document.title} onChange={(title) => update((doc) => ({ ...doc, title }), 'menu-title')} />
      </FieldRow>
      <FieldRow label={t('builder.inspector.subtitle')}>
        <LocalizedInput multiline rows={2} value={document.subtitle} onChange={(subtitle) => update((doc) => ({ ...doc, subtitle }), 'menu-subtitle')} />
      </FieldRow>
    </PanelSection>
  );
}

function BlockInspector({ block }: { block: Block }) {
  const { t } = useTranslation('guestMenu');
  const { updateBlock, canEdit, document, output, locale, primaryLocale, data } = useBuilder();
  const patch = (value: Partial<Block>, mergeKey?: string) => updateBlock(block.id, (current) => ({ ...current, ...value }) as Block, mergeKey);
  const key = (name: string) => `${block.id}-${name}`;

  return (
    <>
      <PanelSection
        title={
          <span className="flex items-center gap-2 normal-case">
            {BLOCK_ICONS[block.type]} {t(`builder.blocks.${block.type}`)}
          </span>
        }
      >
        <p className="truncate text-sm font-medium">{getBlockLabel(block, t, locale, primaryLocale, data.cards)}</p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm">{t('builder.visibility.title')}</span>
          <OutputVisibilityToggles block={block} />
        </div>
      </PanelSection>

      {block.type === 'header' && (
        <>
          <PanelSection title={t('builder.inspector.headerOptions')}>
            {(['showLogo', 'showTitle', 'showSubtitle'] as const).map((option) => (
              <label key={option} className="flex items-center justify-between text-sm">
                {t(`builder.inspector.${option}`)}
                <Toggle toggleSize="sm" checked={block[option]} disabled={!canEdit} onChange={(event) => patch({ [option]: event.target.checked })} />
              </label>
            ))}
          </PanelSection>
          <MenuTexts />
        </>
      )}

      {block.type === 'section' && (
        <>
          <PanelSection title={t('builder.inspector.content')}>
            <FieldRow label={t('builder.inspector.sectionTitle')} hint={t('builder.inspector.sectionTitleHint')}>
              <LocalizedInput value={block.title} onChange={(title) => patch({ title }, key('title'))} />
            </FieldRow>
            <FieldRow label={t('builder.inspector.description')}>
              <LocalizedInput multiline rows={3} value={block.description} onChange={(description) => patch({ description }, key('description'))} />
            </FieldRow>
          </PanelSection>
          <PanelSection title={t('builder.source.title')}>
            <SectionSourceEditor source={block.source} onChange={(source) => patch({ source })} />
          </PanelSection>
          <PanelSection
            title={t('builder.outputs.layout')}
            actions={<InheritBadge overridden={block.layout !== undefined} onReset={canEdit ? () => patch({ layout: undefined }) : undefined} />}
          >
            <Select
              selectSize="sm"
              aria-label={t('builder.outputs.layout')}
              value={block.layout ?? ''}
              disabled={!canEdit}
              onChange={(event) => patch({ layout: (event.target.value || undefined) as GuestMenuLayout | undefined })}
            >
              <option value="">{t('builder.fields.inheritValue', { value: t(`builder.layouts.${document.outputs[output].layout}`) })}</option>
              {LAYOUTS.map((layout) => (
                <option key={layout} value={layout}>
                  {t(`builder.layouts.${layout}`)}
                </option>
              ))}
            </Select>
            {output !== 'web' && block.layout && WEB_ONLY_LAYOUTS.includes(block.layout) ? (
              <p className="text-xs text-base-content/60">{t('builder.layoutsWebOnlyHint')}</p>
            ) : null}
          </PanelSection>
          <PanelSection title={t('builder.inspector.sectionFields')}>
            <details>
              <summary className="cursor-pointer text-sm">{t('builder.inspector.sectionFieldsHint', { output: t(`outputs.${output}`) })}</summary>
              <FieldConfigEditor
                idPrefix={`gm-section-fields-${block.id}`}
                value={block.fields ?? {}}
                inherited={resolveFieldConfig(document, output)}
                output={output}
                disabled={!canEdit}
                onChange={(fields) => patch({ fields: Object.keys(fields).length ? fields : undefined })}
              />
            </details>
          </PanelSection>
          <PanelSection title={t('builder.overrides.title')}>
            <OverridesEditor block={block} />
          </PanelSection>
        </>
      )}

      {block.type === 'text' && (
        <PanelSection title={t('builder.inspector.content')}>
          <FieldRow label={t('builder.inspector.markdown')} hint={t('builder.inspector.markdownHint')}>
            <LocalizedInput multiline rows={10} monospace value={block.content} onChange={(content) => patch({ content }, key('content'))} />
          </FieldRow>
        </PanelSection>
      )}

      {block.type === 'image' && (
        <PanelSection title={t('builder.inspector.content')}>
          <ImagePicker label={t('builder.blocks.image')} value={block.src || null} onChange={(src) => patch({ src: src ?? '' })} />
          <FieldRow label={t('builder.inspector.alt')}>
            <LocalizedInput value={block.alt} onChange={(alt) => patch({ alt }, key('alt'))} />
          </FieldRow>
        </PanelSection>
      )}

      {block.type === 'notice' && (
        <PanelSection title={t('builder.inspector.content')}>
          <FieldRow label={t('builder.notice.preset')} htmlFor={key('preset')}>
            <Select
              id={key('preset')}
              selectSize="sm"
              value={block.preset}
              disabled={!canEdit}
              onChange={(event) => patch({ preset: event.target.value as NoticePreset })}
            >
              {NOTICE_PRESETS.map((preset) => (
                <option key={preset} value={preset}>
                  {t(`builder.notice.${preset}`)}
                </option>
              ))}
            </Select>
          </FieldRow>
          <p className="text-xs text-base-content/60">{t(`builder.notice.${block.preset}Hint`)}</p>
          <FieldRow label={t('builder.notice.text')} hint={block.preset === 'custom' ? t('builder.notice.customRequired') : t('builder.notice.overrideHint')}>
            <LocalizedInput
              multiline
              rows={4}
              value={block.text}
              onChange={(text) => patch({ text: Object.keys(text).length ? text : undefined }, key('text'))}
            />
          </FieldRow>
        </PanelSection>
      )}

      {block.type === 'divider' && (
        <PanelSection>
          <p className="text-sm text-base-content/60">{t('builder.inspector.dividerHint')}</p>
        </PanelSection>
      )}
    </>
  );
}

export function Inspector() {
  const { t } = useTranslation('guestMenu');
  const { selection, document } = useBuilder();
  const block = selection ? document.blocks.find((entry) => entry.id === selection.blockId) : undefined;
  if (!block) {
    return (
      <>
        <PanelSection>
          <p className="text-sm text-base-content/60">{t('builder.inspector.nothingSelected')}</p>
        </PanelSection>
        <MenuTexts />
      </>
    );
  }
  return <BlockInspector key={block.id} block={block} />;
}
