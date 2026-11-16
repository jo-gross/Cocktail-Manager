import React, { useContext, useEffect, useId, useMemo, useState } from 'react';
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
import { APPLY_MODES, selectionCount, type ApplyMode } from '@lib/onboarding/startContentChoice';
import { TemplatePickerDialog } from './TemplatePickerDialog';
import { TemplateAttribution } from './TemplateAttribution';
import { SetupHint } from './SetupHint';

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

/** Latest application of a template (a template may be applied several times). */
export function latestApplied(applied: AppliedTemplate[], key: string): AppliedTemplate | undefined {
  return [...applied].reverse().find((entry) => entry.key === key);
}

/** CATALOG templates in the content language; `null` while loading. */
export function useCatalogTemplates(locale: string) {
  const [templates, setTemplates] = useState<TemplateSummaryDto[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset while the next language loads
    setTemplates(null);
    setFailed(false);
    listCatalogTemplates(locale)
      .then((data) => {
        if (!cancelled) setTemplates(data);
      })
      .catch((error) => {
        console.error('useCatalogTemplates', error);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const { templates: offered, otherLanguage } = useMemo(() => templatesForLocale(templates ?? [], locale), [templates, locale]);
  return { loading: !templates && !failed, failed, offered, otherLanguage };
}

/** Opens the item picker; the confirmed picks switch the tile to "select". */
export function useTemplatePicker(template: TemplateSummaryDto, locale: string) {
  const modalContext = useContext(ModalContext);
  return (initial: TemplateSelectionIds, onConfirm: (picked: TemplateSelectionIds) => void) =>
    modalContext.openModal(
      <TemplatePickerDialog templateKey={template.key} templateName={template.name} locale={locale} initial={initial} onConfirm={onConfirm} />,
    );
}

export interface TemplateTileProps {
  locale: string;
  template: TemplateSummaryDto;
  applied: AppliedTemplate | undefined;
  mode: ApplyMode;
  selection: TemplateSelectionIds;
  onModeChange: (mode: ApplyMode) => void;
  onEditSelection: () => void;
  busy: boolean;
  /** Wizard: the tile is one option of the start choice (radio in the header) instead of having its own apply button. */
  choice?: { name: string; selected: boolean; onSelect: () => void };
  /** Actions at the bottom (standalone: the apply button). */
  actions?: React.ReactNode;
}

/** One collection: description, scope ("all / basics / select"), result of the last application. */
export function TemplateTile({ locale, template, applied, mode, selection, onModeChange, onEditSelection, busy, choice, actions }: TemplateTileProps) {
  const { t } = useTranslation(['onboarding', 'common']);
  const formatCounts = useFormatCounts();
  const groupName = useId();
  const titleId = useId();
  const selectedCount = selectionCount(selection);
  const basicsCounts = { ...template.counts, cocktails: 0, cards: 0 };
  const highlighted = choice ? choice.selected : false;

  const title = (
    <h3 id={titleId} className="text-lg leading-snug font-semibold">
      {template.name}
    </h3>
  );

  return (
    <article
      aria-labelledby={titleId}
      aria-busy={busy || undefined}
      className={cn(
        '@container flex h-full flex-col gap-4 rounded-xl border bg-base-100 p-4 transition-colors',
        highlighted ? 'border-primary ring-1 ring-primary' : applied ? 'border-success ring-1 ring-success' : 'border-base-300',
      )}
    >
      <header className="flex flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          {choice ? (
            <label className="flex min-w-0 cursor-pointer items-start gap-3 has-[:focus-visible]:rounded-md has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary">
              <Radio name={choice.name} className="mt-1" checked={choice.selected} disabled={busy} aria-labelledby={titleId} onChange={choice.onSelect} />
              {title}
            </label>
          ) : (
            title
          )}
          {busy ? (
            <Badge variant="neutral" size="sm" className="shrink-0 gap-1">
              <Loading size="xs" />
              {t('onboarding:content.applying')}
            </Badge>
          ) : applied ? (
            <Badge variant="success" size="sm" className="shrink-0 gap-1">
              <FaCheckCircle aria-hidden />
              {t('onboarding:content.applied')}
            </Badge>
          ) : null}
        </div>
        {template.description ? <p className={cn('text-sm text-base-content/70', choice && 'pl-8')}>{template.description}</p> : null}
      </header>

      {/* Side by side when the tile is wide (single collection), stacked in a two-column grid. */}
      <fieldset className="grid gap-2 @xl:grid-cols-3" disabled={busy}>
        <legend className="sr-only">{t('onboarding:content.modeLabel', { template: template.name })}</legend>
        {APPLY_MODES.map((entry) => {
          const checked = mode === entry;
          // In the wizard the scope of a collection that is not chosen is shown neutral.
          const active = checked && (!choice || choice.selected);
          return (
            <label
              key={entry}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary',
                active ? 'border-primary bg-primary/10' : 'border-base-300 hover:bg-base-200',
              )}
            >
              <Radio name={groupName} className="mt-0.5" checked={checked} onChange={() => onModeChange(entry)} />
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
        {mode === 'selection' || actions ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {mode === 'selection' ? (
              <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onEditSelection}>
                {t('onboarding:content.editSelection')}
              </Button>
            ) : null}
            {actions}
          </div>
        ) : null}
        <TemplateAttribution templateKey={template.key} locale={locale} source={template.source} />
      </div>
    </article>
  );
}

/** Tile with its own apply button (modal on the help page / empty lists). */
function StandaloneTemplateTile({
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
  const [mode, setMode] = useState<ApplyMode>('all');
  const [selection, setSelection] = useState<TemplateSelectionIds>(emptyTemplateSelection);
  const [applying, setApplying] = useState(false);
  const pick = useTemplatePicker(template, locale);

  const openPicker = () =>
    pick(selection, (picked) => {
      setSelection(picked);
      setMode('selection');
    });

  const apply = async () => {
    if (mode === 'selection' && selectionCount(selection) === 0) {
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

  return (
    <TemplateTile
      locale={locale}
      template={template}
      applied={applied}
      mode={mode}
      selection={selection}
      busy={applying}
      onModeChange={(entry) => {
        setMode(entry);
        if (entry === 'selection' && selectionCount(selection) === 0) openPicker();
      }}
      onEditSelection={openPicker}
      actions={
        <Button type="button" variant={applied ? 'outline' : 'primary'} size="sm" disabled={applying} onClick={apply}>
          {applying ? <Loading size="sm" /> : null}
          {applied ? t('onboarding:content.applyAgain') : t('onboarding:content.apply')}
        </Button>
      }
    />
  );
}

/** Loading / error / "none for this language" states around the collection tiles. */
export function CatalogTemplateList({
  catalog,
  children,
}: {
  catalog: ReturnType<typeof useCatalogTemplates>;
  children: (offered: TemplateSummaryDto[]) => React.ReactNode;
}) {
  const { t } = useTranslation(['onboarding']);
  if (catalog.failed) return <Alert variant="warning">{t('onboarding:content.loadError')}</Alert>;
  if (catalog.loading)
    return (
      <div className="grid gap-4 md:grid-cols-2" aria-busy="true">
        <Skeleton className="h-72 w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  if (catalog.offered.length === 0) return <p className="text-sm text-base-content/70">{t('onboarding:content.none')}</p>;
  return (
    <>
      {catalog.otherLanguage ? <SetupHint>{t('onboarding:content.otherLanguage')}</SetupHint> : null}
      <div className={cn('grid gap-4', catalog.offered.length > 1 && 'md:grid-cols-2')}>{children(catalog.offered)}</div>
    </>
  );
}

/** Notes on prices and allergens of the start content. */
export function StartContentHints({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation(['onboarding']);
  return (
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
  );
}

interface StartContentPanelProps {
  workspaceId: string;
  /** Content language: lists the collections in this language and their names. */
  locale: string;
  applied: AppliedTemplate[];
  onApplied: (applied: AppliedTemplate) => void;
}

/** Start content collections (CATALOG templates) with "all / basics / select", each applied with its own button. */
export function StartContentPanel({ workspaceId, locale, applied, onApplied }: StartContentPanelProps) {
  const catalog = useCatalogTemplates(locale);

  return (
    <div className="flex flex-col gap-4">
      <CatalogTemplateList catalog={catalog}>
        {(offered) =>
          offered.map((template) => (
            <StandaloneTemplateTile
              key={template.key}
              workspaceId={workspaceId}
              locale={locale}
              template={template}
              applied={latestApplied(applied, template.key)}
              onApplied={onApplied}
            />
          ))
        }
      </CatalogTemplateList>
      <StartContentHints workspaceId={workspaceId} />
    </div>
  );
}

/** Totals over all applied templates (for summaries). */
export function sumCreated(applied: AppliedTemplate[]): Record<TemplateItemKind, number> {
  const total = Object.fromEntries(TEMPLATE_ITEM_KINDS.map((kind) => [kind, 0])) as Record<TemplateItemKind, number>;
  for (const entry of applied) for (const kind of TEMPLATE_ITEM_KINDS) total[kind] += entry.result.created[kind];
  return total;
}
