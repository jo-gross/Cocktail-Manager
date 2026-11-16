import React, { useContext, useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { FaCheckCircle } from 'react-icons/fa';
import { Alert, Badge, Button, Loading, Radio, Skeleton, cn } from '@components/ui';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { alertService } from '@lib/alertService';
import { alertApiV1Error } from '@lib/network/apiV1';
import { applyTemplate, listCatalogTemplates, type TemplateApplyResultDto, type TemplateSummaryDto } from '@lib/network/templates';
import {
  emptyTemplateSelection,
  TEMPLATE_ITEM_KINDS,
  templatesForLocale,
  type TemplateItemKind,
  type TemplateSelectionIds,
} from '@lib/onboarding/templateSelection';
import { TemplatePickerDialog } from './TemplatePickerDialog';
import { TemplateAttribution } from './TemplateAttribution';
import { SetupHint } from './SetupHint';

type ApplyMode = 'all' | 'basics' | 'selection';
const APPLY_MODES: ApplyMode[] = ['all', 'basics', 'selection'];

export interface AppliedTemplate {
  key: string;
  name: string;
  result: TemplateApplyResultDto;
}

/** "3 Gläser, 12 Zutaten" – only kinds with a count. */
export function useFormatCounts() {
  const { t } = useTranslation(['onboarding']);
  return (counts: Record<TemplateItemKind, number>) =>
    TEMPLATE_ITEM_KINDS.filter((kind) => counts[kind] > 0)
      .map((kind) => t(`onboarding:counts.${kind}`, { count: counts[kind] }))
      .join(', ');
}

function TemplateTile({
  workspaceId,
  locale,
  template,
  applied,
  onApplied,
}: {
  workspaceId: string;
  locale: string;
  template: TemplateSummaryDto;
  applied: AppliedTemplate | undefined;
  onApplied: (applied: AppliedTemplate) => void;
}) {
  const { t } = useTranslation(['onboarding', 'common']);
  const modalContext = useContext(ModalContext);
  const formatCounts = useFormatCounts();
  const groupName = useId();
  const titleId = useId();
  const [mode, setMode] = useState<ApplyMode>('all');
  const [selection, setSelection] = useState<TemplateSelectionIds>(emptyTemplateSelection);
  const [applying, setApplying] = useState(false);
  const selectedCount = TEMPLATE_ITEM_KINDS.reduce((sum, kind) => sum + selection[kind].length, 0);

  const openPicker = () =>
    modalContext.openModal(
      <TemplatePickerDialog
        templateKey={template.key}
        templateName={template.name}
        locale={locale}
        initial={selection}
        onConfirm={(picked) => {
          setSelection(picked);
          setMode('selection');
        }}
      />,
    );

  const apply = async () => {
    if (mode === 'selection' && selectedCount === 0) {
      openPicker();
      return;
    }
    setApplying(true);
    try {
      const result = await applyTemplate(workspaceId, template.key, { mode, ...(mode === 'selection' ? { selection } : {}) });
      onApplied({ key: template.key, name: template.name, result });
      alertService.success(t('onboarding:content.appliedToast', { template: template.name }));
    } catch (error) {
      alertApiV1Error(error, t('onboarding:content.applyError'));
    } finally {
      setApplying(false);
    }
  };

  const basicsCounts = { ...template.counts, cocktails: 0, cards: 0 };

  return (
    <article
      aria-labelledby={titleId}
      className={cn(
        '@container flex h-full flex-col gap-4 rounded-xl border bg-base-100 p-4 transition-colors',
        applied ? 'border-success ring-1 ring-success' : 'border-base-300',
      )}
    >
      <header className="flex flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <h3 id={titleId} className="text-lg leading-snug font-semibold">
            {template.name}
          </h3>
          {applied ? (
            <Badge variant="success" size="sm" className="shrink-0 gap-1">
              <FaCheckCircle aria-hidden />
              {t('onboarding:content.applied')}
            </Badge>
          ) : null}
        </div>
        {template.description ? <p className="text-sm text-base-content/70">{template.description}</p> : null}
      </header>

      {/* Side by side when the tile is wide (single collection), stacked in a two-column grid. */}
      <fieldset className="grid gap-2 @xl:grid-cols-3" disabled={applying}>
        <legend className="sr-only">{t('onboarding:content.modeLabel', { template: template.name })}</legend>
        {APPLY_MODES.map((entry) => {
          const checked = mode === entry;
          return (
            <label
              key={entry}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary',
                checked ? 'border-primary bg-primary/10' : 'border-base-300 hover:bg-base-200',
              )}
            >
              <Radio
                name={groupName}
                className="mt-0.5"
                checked={checked}
                onChange={() => {
                  setMode(entry);
                  if (entry === 'selection' && selectedCount === 0) openPicker();
                }}
              />
              <span className="flex min-w-0 flex-col">
                <span className="font-medium">{t(`onboarding:content.mode.${entry}`)}</span>
                <span className="text-xs text-base-content/60">
                  {entry === 'all'
                    ? formatCounts(template.counts)
                    : entry === 'basics'
                      ? formatCounts(basicsCounts)
                      : selectedCount > 0
                        ? t('onboarding:content.selectionCount', { count: selectedCount })
                        : t('onboarding:content.mode.selectionHelp')}
                </span>
              </span>
            </label>
          );
        })}
      </fieldset>

      {applied ? (
        <div role="status" className="flex flex-col gap-0.5 rounded-lg bg-base-200 px-3 py-2 text-sm">
          <span className="font-medium">{t('onboarding:content.result.title')}</span>
          <span>{t('onboarding:content.result.created', { items: formatCounts(applied.result.created) || t('onboarding:content.result.none') })}</span>
          {TEMPLATE_ITEM_KINDS.some((kind) => applied.result.linked[kind] > 0) ? (
            <span className="text-base-content/70">{t('onboarding:content.result.linked', { items: formatCounts(applied.result.linked) })}</span>
          ) : null}
          {TEMPLATE_ITEM_KINDS.some((kind) => applied.result.skipped[kind] > 0) ? (
            <span className="text-base-content/70">{t('onboarding:content.result.skipped', { items: formatCounts(applied.result.skipped) })}</span>
          ) : null}
        </div>
      ) : null}

      {/* Pinned to the bottom so the actions line up across tiles of different length. */}
      <div className="mt-auto flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-end gap-2">
          {mode === 'selection' ? (
            <Button type="button" variant="ghost" size="sm" disabled={applying} onClick={openPicker}>
              {t('onboarding:content.editSelection')}
            </Button>
          ) : null}
          <Button type="button" variant={applied ? 'outline' : 'primary'} size="sm" disabled={applying} onClick={apply}>
            {applying ? <Loading size="sm" /> : null}
            {applied ? t('onboarding:content.applyAgain') : t('onboarding:content.apply')}
          </Button>
        </div>
        <TemplateAttribution templateKey={template.key} locale={locale} source={template.source} />
      </div>
    </article>
  );
}

interface StartContentPanelProps {
  workspaceId: string;
  /** Content language: lists the collections in this language and their names. */
  locale: string;
  applied: AppliedTemplate[];
  onApplied: (applied: AppliedTemplate) => void;
}

/** Start content collections (CATALOG templates) with "all / basics / select" and the result of applying them. */
export function StartContentPanel({ workspaceId, locale, applied, onApplied }: StartContentPanelProps) {
  const { t } = useTranslation(['onboarding']);
  const [templates, setTemplates] = useState<TemplateSummaryDto[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setTemplates(null);
    setFailed(false);
    listCatalogTemplates(locale)
      .then((data) => {
        if (!cancelled) setTemplates(data);
      })
      .catch((error) => {
        console.error('StartContentPanel', error);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const { templates: offered, otherLanguage } = templatesForLocale(templates ?? [], locale);

  return (
    <div className="flex flex-col gap-4">
      {failed ? (
        <Alert variant="warning">{t('onboarding:content.loadError')}</Alert>
      ) : !templates ? (
        <div className="grid gap-4 md:grid-cols-2" aria-busy="true">
          <Skeleton className="h-72 w-full rounded-xl" />
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      ) : offered.length === 0 ? (
        <p className="text-sm text-base-content/70">{t('onboarding:content.none')}</p>
      ) : (
        <>
          {otherLanguage ? <SetupHint>{t('onboarding:content.otherLanguage')}</SetupHint> : null}
          <div className={cn('grid gap-4', offered.length > 1 && 'md:grid-cols-2')}>
            {offered.map((template) => (
              <TemplateTile
                key={template.key}
                workspaceId={workspaceId}
                locale={locale}
                template={template}
                applied={[...applied].reverse().find((entry) => entry.key === template.key)}
                onApplied={onApplied}
              />
            ))}
          </div>
        </>
      )}

      <SetupHint>
        <ul className="flex flex-col gap-1">
          <li>{t('onboarding:content.hintPrices')}</li>
          <li>
            {t('onboarding:content.hintAllergens')}{' '}
            <Link href={`/workspaces/${workspaceId}/manage/guest-info`} className="link font-medium">
              {t('onboarding:content.hintAllergensLink')}
            </Link>
          </li>
        </ul>
      </SetupHint>
    </div>
  );
}

/** Totals over all applied templates (for summaries). */
export function sumCreated(applied: AppliedTemplate[]): Record<TemplateItemKind, number> {
  const total = Object.fromEntries(TEMPLATE_ITEM_KINDS.map((kind) => [kind, 0])) as Record<TemplateItemKind, number>;
  for (const entry of applied) for (const kind of TEMPLATE_ITEM_KINDS) total[kind] += entry.result.created[kind];
  return total;
}
