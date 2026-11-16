import React, { useContext, useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { FaCheckCircle } from 'react-icons/fa';
import { Alert, Button, Card, CardBody, Loading, Radio, Skeleton } from '@components/ui';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { alertService } from '@lib/alertService';
import { alertApiV1Error } from '@lib/network/apiV1';
import { applyTemplate, listCatalogTemplates, type TemplateApplyResultDto, type TemplateSummaryDto } from '@lib/network/templates';
import { settingsHref } from '@components/settings/settingsNavigation';
import {
  emptyTemplateSelection,
  TEMPLATE_ITEM_KINDS,
  templatesForLocale,
  type TemplateItemKind,
  type TemplateSelectionIds,
} from '@lib/onboarding/templateSelection';
import { TemplatePickerDialog } from './TemplatePickerDialog';
import { TemplateAttribution } from './TemplateAttribution';

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
    <Card>
      <CardBody compact className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            {template.name}
            {applied ? <FaCheckCircle aria-label={t('onboarding:content.applied')} className="text-success" /> : null}
          </h3>
          {template.description ? <p className="text-sm text-base-content/70">{template.description}</p> : null}
          <p className="text-xs text-base-content/60">{formatCounts(template.counts)}</p>
        </div>

        <fieldset className="flex flex-col gap-2" disabled={applying}>
          <legend className="sr-only">{t('onboarding:content.modeLabel', { template: template.name })}</legend>
          {APPLY_MODES.map((entry) => (
            <label key={entry} className="flex cursor-pointer items-start gap-2 text-sm">
              <Radio
                name={groupName}
                className="mt-0.5"
                checked={mode === entry}
                onChange={() => {
                  setMode(entry);
                  if (entry === 'selection' && selectedCount === 0) openPicker();
                }}
              />
              <span className="flex flex-col">
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
          ))}
        </fieldset>

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

        <TemplateAttribution templateKey={template.key} locale={locale} source={template.source} />
      </CardBody>
    </Card>
  );
}

interface StartContentPanelProps {
  workspaceId: string;
  /** Content language: lists the collections in this language and their names. */
  locale: string;
  applied: AppliedTemplate[];
  onApplied: (applied: AppliedTemplate) => void;
  /** Show "Import a backup instead" (setup wizard). */
  showBackupLink?: boolean;
}

/** Start content collections (CATALOG templates) with "all / basics / select" and the result of applying them. */
export function StartContentPanel({ workspaceId, locale, applied, onApplied, showBackupLink = false }: StartContentPanelProps) {
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
          <Skeleton className="h-56 w-full rounded-2xl" />
          <Skeleton className="h-56 w-full rounded-2xl" />
        </div>
      ) : offered.length === 0 ? (
        <p className="text-sm text-base-content/70">{t('onboarding:content.none')}</p>
      ) : (
        <>
          {otherLanguage ? <p className="text-sm text-base-content/70">{t('onboarding:content.otherLanguage')}</p> : null}
          <div className="grid gap-4 md:grid-cols-2">
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

      <ul className="list-disc space-y-1 pl-5 text-sm text-base-content/70">
        <li>{t('onboarding:content.hintPrices')}</li>
        <li>
          {t('onboarding:content.hintAllergens')}{' '}
          <Link href={`/workspaces/${workspaceId}/manage/guest-info`} className="link">
            {t('onboarding:content.hintAllergensLink')}
          </Link>
        </li>
      </ul>
      {showBackupLink ? (
        <Link href={settingsHref(workspaceId, 'data')} className="link self-start text-sm">
          {t('onboarding:content.importBackup')}
        </Link>
      ) : null}
    </div>
  );
}

/** Totals over all applied templates (for summaries). */
export function sumCreated(applied: AppliedTemplate[]): Record<TemplateItemKind, number> {
  const total = Object.fromEntries(TEMPLATE_ITEM_KINDS.map((kind) => [kind, 0])) as Record<TemplateItemKind, number>;
  for (const entry of applied) for (const kind of TEMPLATE_ITEM_KINDS) total[kind] += entry.result.created[kind];
  return total;
}
