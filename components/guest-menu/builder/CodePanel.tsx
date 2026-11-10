/**
 * "Code" tab (expert): Liquid slots + CSS of the current output's template.
 * Edits are stored as per-menu slot overrides (`document.templates[output].slots`);
 * they can be saved as a reusable workspace template (`custom:<id>`).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useTranslation } from 'react-i18next';
import { FaDownload, FaExclamationTriangle, FaUndo, FaUpload } from 'react-icons/fa';
import { Alert, Badge, Button, cn, Input } from '@components/ui';
import { alertService } from '@lib/alertService';
import { ApiV1RequestError, alertApiV1Error } from '@lib/network/apiV1';
import { createGuestMenuTemplate, updateGuestMenuTemplate, type GuestMenuPublishIssue } from '@lib/network/guestMenus';
import {
  CUSTOM_TEMPLATE_PREFIX,
  GUEST_MENU_SCHEMA_VERSION,
  TEMPLATE_SLOTS,
  safeParseGuestMenuDocument,
  type GuestMenuTemplateDefinition,
  type TemplateSlot,
  type TemplateSlotOverrides,
} from '@lib/guest-menu/schema';
import { getCustomTemplateDbId } from '@lib/guest-menu/templates';
import type { CodeEditorError, CodeEditorHandle } from './CodeEditor';
import { useBuilder } from './BuilderContext';
import { CODE_REFERENCE, CSS_REFERENCE, type ReferenceEntry } from './codeReference';

const CodeEditor = dynamic(() => import('./CodeEditor'), { ssr: false, loading: () => <div className="h-full animate-pulse rounded-md bg-base-200" /> });

type CodeTab = TemplateSlot | 'css' | 'themeCss';
const CODE_TABS: CodeTab[] = ['item', 'item_detail', 'section_header', 'menu_header', 'footer', 'css', 'themeCss'];

interface ValidationError {
  slot: string;
  message: string;
  line: number | null;
}

function slotsOf(definition: GuestMenuTemplateDefinition | undefined): TemplateSlotOverrides {
  return definition?.slots ?? {};
}

export function CodePanel({ publishIssues }: { publishIssues: GuestMenuPublishIssue[] }) {
  const { t } = useTranslation('guestMenu');
  const { document, update, output, data, canEdit, workspaceId, menu, preview } = useBuilder();
  const [tab, setTab] = useState<CodeTab>('item');
  const [showBaseCss, setShowBaseCss] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [syntaxErrors, setSyntaxErrors] = useState<ValidationError[]>([]);
  const editorRef = useRef<CodeEditorHandle>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const ref = document.templates[output];
  const customId = getCustomTemplateDbId(ref.templateId);
  const customTemplate = customId ? data.customTemplates.find((template) => template.id === customId) : undefined;
  const baseTemplateId = customTemplate?.definition.baseTemplateId ?? ref.templateId;
  const builtIn =
    data.builtIn?.templates.find((template) => template.id === baseTemplateId) ?? data.builtIn?.templates.find((template) => template.id === 'classic');
  const overrides = ref.slots ?? {};

  /** Source the slot falls back to without a menu override. */
  const inherited = (slot: CodeTab): string => {
    if (slot === 'themeCss') return '';
    if (slot === 'css') return slotsOf(customTemplate?.definition).css ?? '';
    return slotsOf(customTemplate?.definition)[slot]?.trim() ? slotsOf(customTemplate?.definition)[slot]! : (builtIn?.slots[slot] ?? '');
  };
  const valueOf = (slot: CodeTab): string => {
    if (slot === 'themeCss') return document.theme.customCss ?? '';
    const own = overrides[slot];
    return own != null && own.trim() !== '' ? own : inherited(slot);
  };
  const isOverridden = (slot: CodeTab) => (slot === 'themeCss' ? !!document.theme.customCss?.trim() : !!overrides[slot]?.trim());

  const setSlot = (slot: CodeTab, value: string) => {
    if (slot === 'themeCss') {
      update((doc) => ({ ...doc, theme: { ...doc.theme, customCss: value.trim() ? value : null } }), 'code-themeCss');
      return;
    }
    update((doc) => {
      const slots: TemplateSlotOverrides = { ...(doc.templates[output].slots ?? {}) };
      if (value === inherited(slot) || value.trim() === '') delete slots[slot];
      else slots[slot] = value;
      const nextRef = { ...doc.templates[output], slots: Object.keys(slots).length > 0 ? slots : undefined };
      return { ...doc, templates: { ...doc.templates, [output]: nextRef } };
    }, `code-${output}-${slot}`);
  };

  // Live syntax validation of the effective template (debounced, parse only).
  const effectiveSlots = useMemo(() => {
    const slots: TemplateSlotOverrides = {};
    for (const slot of TEMPLATE_SLOTS) slots[slot] = valueOf(slot);
    return slots;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document.templates, output, customTemplate, builtIn]);
  const extraCss = overrides.css ?? '';
  const themeCss = document.theme.customCss ?? '';

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const [{ validateTemplateSyntax }, { scopeCss }] = await Promise.all([import('@lib/guest-menu/render'), import('@lib/guest-menu/render/css')]);
      const errors: ValidationError[] = validateTemplateSyntax({
        id: ref.templateId,
        baseTemplateId,
        slots: effectiveSlots as Record<TemplateSlot, string>,
        css: [slotsOf(customTemplate?.definition).css ?? '', extraCss].join('\n'),
        customizedSlots: [],
      });
      for (const error of scopeCss(themeCss, '.gm-root').errors) errors.push({ slot: 'themeCss', message: error.message, line: error.line });
      if (!cancelled) setSyntaxErrors(errors);
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [effectiveSlots, extraCss, themeCss, ref.templateId, baseTemplateId, customTemplate]);

  const errorsFor = (slot: CodeTab): ValidationError[] => {
    const fromPublish = publishIssues
      .filter((issue) => issue.output === output && (slot === 'themeCss' ? issue.source === 'customCss' : issue.slot === slot && issue.source !== 'customCss'))
      .map((issue) => ({ slot, message: issue.message, line: issue.line }));
    const fromPreview =
      preview && preview.dto.output === output && slot !== 'css' && slot !== 'themeCss'
        ? preview.rendered.errors.filter((error) => error.slot === slot).map((error) => ({ slot, message: error.message, line: error.line }))
        : [];
    return [...syntaxErrors.filter((error) => error.slot === slot), ...fromPublish, ...fromPreview];
  };
  const currentErrors = errorsFor(tab);
  const editorErrors: CodeEditorError[] = currentErrors.filter((error) => error.line != null).map((error) => ({ line: error.line!, message: error.message }));

  const mergedSlots = (): TemplateSlotOverrides => {
    const slots: TemplateSlotOverrides = { ...slotsOf(customTemplate?.definition) };
    for (const [key, value] of Object.entries(overrides)) if (value?.trim()) slots[key as keyof TemplateSlotOverrides] = value;
    return slots;
  };
  const clearOverridesAndUse = (templateId: string) => update((doc) => ({ ...doc, templates: { ...doc.templates, [output]: { templateId } } }));

  const saveAsTemplate = async (mode: 'create' | 'update') => {
    setSavingTemplate(true);
    try {
      const definition: GuestMenuTemplateDefinition = {
        schemaVersion: GUEST_MENU_SCHEMA_VERSION,
        baseTemplateId: builtIn?.id ?? 'classic',
        slots: mergedSlots(),
        theme: document.theme,
      };
      if (mode === 'update' && customTemplate) {
        await updateGuestMenuTemplate(workspaceId, customTemplate.id, { name: customTemplate.name, definition });
        alertService.success(t('builder.code.templateUpdated'));
      } else {
        const created = await createGuestMenuTemplate(workspaceId, { name: templateName.trim(), definition });
        clearOverridesAndUse(created.templateId);
        setTemplateName('');
        alertService.success(t('builder.code.templateCreated'));
      }
      await data.reloadCustomTemplates();
      if (mode === 'update' && customTemplate) clearOverridesAndUse(customTemplate.templateId);
    } catch (error) {
      if (error instanceof ApiV1RequestError && error.status === 422) alertService.error(t('errors.templateError'));
      else alertApiV1Error(error, t('errors.save'));
    } finally {
      setSavingTemplate(false);
    }
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(document, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement('a');
    anchor.href = url;
    anchor.download = `${menu.slug}.guest-menu.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file: File) => {
    try {
      const parsed = safeParseGuestMenuDocument(JSON.parse(await file.text()));
      if (!parsed.success) {
        alertService.error(t('builder.code.importInvalid'));
        return;
      }
      update(() => parsed.data);
      alertService.success(t('builder.code.imported'));
    } catch {
      alertService.error(t('builder.code.importInvalid'));
    }
  };

  const isCss = tab === 'css' || tab === 'themeCss';
  const referenceGroups = CODE_REFERENCE.filter((group) => !group.slots || (!isCss && group.slots.includes(tab as TemplateSlot)));
  const insert = (entry: ReferenceEntry) => editorRef.current?.insert(entry.snippet);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-3">
      <Alert variant="info" className="py-2 text-xs">
        {t('builder.code.intro', { output: t(`outputs.${output}`), template: customTemplate?.name ?? builtIn?.name ?? ref.templateId })}
      </Alert>

      <div className="flex flex-wrap gap-1" role="tablist">
        {CODE_TABS.map((slot) => {
          const count = errorsFor(slot).length;
          return (
            <button
              key={slot}
              type="button"
              role="tab"
              aria-selected={tab === slot}
              onClick={() => setTab(slot)}
              className={cn(
                'flex items-center gap-1 rounded-md px-2 py-1 font-mono text-xs',
                tab === slot ? 'bg-primary text-primary-content' : 'bg-base-200 hover:bg-base-300',
              )}
            >
              {slot === 'themeCss' ? t('builder.code.themeCss') : slot}
              {isOverridden(slot) && <span className="h-1.5 w-1.5 rounded-full bg-info" title={t('builder.overridden')} />}
              {count > 0 && <FaExclamationTriangle className="text-error" />}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-base-content/60">{t(`builder.code.tabHints.${tab}`)}</span>
        {isOverridden(tab) && tab !== 'themeCss' && canEdit && (
          <Button type="button" size="xs" variant="ghost" onClick={() => setSlot(tab, '')}>
            <FaUndo /> {t('builder.code.resetSlot')}
          </Button>
        )}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 2xl:grid-cols-[minmax(0,1fr)_14rem]">
        <div className="flex min-h-[22rem] flex-col gap-2">
          <div className="min-h-0 flex-1">
            <CodeEditor
              key={`${output}-${tab}`}
              editorRef={editorRef}
              language={isCss ? 'css' : 'html'}
              value={valueOf(tab)}
              readOnly={!canEdit}
              ariaLabel={t('builder.code.editorLabel', { slot: tab })}
              errors={editorErrors}
              onChange={(value) => setSlot(tab, value)}
            />
          </div>
          {currentErrors.length > 0 && (
            <ul className="flex max-h-28 flex-col gap-1 overflow-auto rounded-md bg-error/10 p-2 text-xs text-error">
              {currentErrors.map((error, index) => (
                <li key={`${error.message}-${index}`}>
                  <button type="button" className="text-left hover:underline" onClick={() => error.line && editorRef.current?.goToLine(error.line)}>
                    {error.line != null ? t('builder.code.errorLine', { line: error.line, message: error.message }) : error.message}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {tab === 'css' && (
            <div className="flex flex-col gap-1">
              <button type="button" className="self-start text-xs underline" onClick={() => setShowBaseCss((value) => !value)}>
                {showBaseCss ? t('builder.code.hideBaseCss') : t('builder.code.showBaseCss')}
              </button>
              {showBaseCss && (
                <pre className="max-h-48 overflow-auto rounded-md bg-base-200 p-2 text-[0.7rem]">{`${data.builtIn?.baseCss ?? ''}\n${builtIn?.css ?? ''}`}</pre>
              )}
            </div>
          )}
        </div>

        <aside
          className="flex max-h-[28rem] flex-col gap-2 overflow-auto rounded-md border border-base-300 p-2 2xl:max-h-none"
          aria-label={t('builder.code.reference.title')}
        >
          <h4 className="text-xs font-semibold">{t('builder.code.reference.title')}</h4>
          <p className="text-[0.7rem] text-base-content/60">{t('builder.code.reference.hint')}</p>
          {(isCss ? [{ key: 'css' as const, entries: CSS_REFERENCE }] : referenceGroups).map((group) => (
            <div key={group.key} className="flex flex-col gap-0.5">
              <span className="text-[0.7rem] font-semibold text-base-content/70 uppercase">{t(`builder.code.reference.groups.${group.key}`)}</span>
              {group.entries.map((entry) => (
                <button
                  key={entry.label}
                  type="button"
                  disabled={!canEdit}
                  title={entry.snippet}
                  onClick={() => insert(entry)}
                  className="truncate rounded px-1 py-0.5 text-left font-mono text-[0.7rem] hover:bg-base-200"
                >
                  {entry.label}
                </button>
              ))}
            </div>
          ))}
        </aside>
      </div>

      {canEdit && (
        <div className="flex flex-col gap-2 border-t border-base-300 pt-2">
          <div className="flex items-center gap-2">
            {customTemplate ? (
              <Badge size="sm" variant="info">
                {t('builder.code.usingCustom', { name: customTemplate.name })}
              </Badge>
            ) : null}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Input
              inputSize="sm"
              className="min-w-0 flex-1"
              placeholder={t('builder.code.templateNamePlaceholder')}
              aria-label={t('builder.code.templateName')}
              value={templateName}
              onChange={(event) => setTemplateName(event.target.value)}
            />
            <Button type="button" size="sm" variant="outline" loading={savingTemplate} disabled={!templateName.trim()} onClick={() => saveAsTemplate('create')}>
              {t('builder.code.saveAsTemplate')}
            </Button>
            {customTemplate && (
              <Button type="button" size="sm" variant="outline" loading={savingTemplate} onClick={() => saveAsTemplate('update')}>
                {t('builder.code.updateTemplate')}
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={exportJson}>
              <FaDownload /> {t('builder.code.exportJson')}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => importRef.current?.click()}>
              <FaUpload /> {t('builder.code.importJson')}
            </Button>
            <input
              ref={importRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) void importJson(file);
              }}
            />
          </div>
          {ref.templateId.startsWith(CUSTOM_TEMPLATE_PREFIX) && !customTemplate && !data.loading && (
            <p className="text-xs text-warning">{t('builder.code.customMissing')}</p>
          )}
        </div>
      )}
    </div>
  );
}
