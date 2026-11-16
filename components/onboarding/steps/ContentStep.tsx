import React, { useContext, useEffect, useId, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Button, Loading, Radio, cn } from '@components/ui';
import { FormSection } from '@components/forms/FormSection';
import { settingsHref } from '@components/settings/settingsNavigation';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { alertService } from '@lib/alertService';
import { alertApiV1Error } from '@lib/network/apiV1';
import { applyTemplate, type TemplateSummaryDto } from '@lib/network/templates';
import { emptyTemplateSelection } from '@lib/onboarding/templateSelection';
import { effectiveStartContentChoice, selectionCount, startContentAction, type ApplyMode, type StartContentChoice } from '@lib/onboarding/startContentChoice';
import {
  CatalogTemplateList,
  latestApplied,
  StartContentHints,
  TemplateTile,
  useCatalogTemplates,
  useTemplatePicker,
  type AppliedTemplate,
} from '../StartContentPanel';
import { TemplatePickerDialog } from '../TemplatePickerDialog';
import { SetupHint } from '../SetupHint';
import type { BusinessType } from '@lib/onboarding/setupWizard';
import type { SetupStepProps } from './types';

interface ContentStepProps extends SetupStepProps {
  locale: string;
  /** Sent along when a collection is added: the server picks the design of its guest menus. */
  businessType: BusinessType | null;
  applied: AppliedTemplate[];
  onApplied: (applied: AppliedTemplate) => void;
  /** Kept by the wizard so the choice survives going back; `null` = the default choice. */
  choice: StartContentChoice | null;
  onChoiceChange: (choice: StartContentChoice | null) => void;
  /** The wizard's primary button for the current choice: its label (`null` = plain "Next") and whether it must wait (collections loading). */
  onPrimaryChange: (primary: { label: string | null; loading: boolean } | null) => void;
}

/** Asked when the stepper leaves the step forward while a collection is chosen but not added yet. */
function PendingContentDialog({
  templateName,
  onApply,
  onProceed,
  onSkip,
}: {
  templateName: string;
  onApply: () => Promise<boolean>;
  onProceed: () => void;
  onSkip: () => void;
}) {
  const { t } = useTranslation(['onboarding', 'common']);
  const modalContext = useContext(ModalContext);
  const [applying, setApplying] = useState(false);

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <h2 className="text-2xl font-bold">{t('onboarding:content.pending.title')}</h2>
      <p>{t('onboarding:content.pending.message', { template: templateName })}</p>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" disabled={applying} onClick={() => modalContext.closeModal()}>
          {t('common:cancel')}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={applying}
          onClick={() => {
            modalContext.closeModal();
            onSkip();
          }}
        >
          {t('onboarding:content.pending.skip')}
        </Button>
        <Button
          type="button"
          variant="primary"
          disabled={applying}
          onClick={async () => {
            setApplying(true);
            const ok = await onApply();
            setApplying(false);
            if (!ok) return;
            modalContext.closeModal();
            onProceed();
          }}
        >
          {applying ? <Loading size="sm" /> : null}
          {t('onboarding:content.pending.apply')}
        </Button>
      </div>
    </div>
  );
}

function ChoiceTemplateTile({
  locale,
  template,
  applied,
  choice,
  groupName,
  busy,
  onChoiceChange,
}: {
  locale: string;
  template: TemplateSummaryDto;
  applied: AppliedTemplate | undefined;
  choice: StartContentChoice | null;
  groupName: string;
  busy: boolean;
  onChoiceChange: (choice: StartContentChoice) => void;
}) {
  const pick = useTemplatePicker(template, locale);
  const chosen = choice?.kind === 'template' && choice.key === template.key ? choice : null;
  const mode = chosen?.mode ?? 'all';
  const selection = chosen?.selection ?? emptyTemplateSelection();

  const openPicker = () => pick(selection, (picked) => onChoiceChange({ kind: 'template', key: template.key, mode: 'selection', selection: picked }));

  const choose = (entry: ApplyMode) => onChoiceChange({ kind: 'template', key: template.key, mode: entry, selection });

  return (
    <TemplateTile
      locale={locale}
      template={template}
      applied={applied}
      mode={mode}
      selection={selection}
      busy={busy}
      choice={{ name: groupName, selected: !!chosen, onSelect: () => choose(mode) }}
      onModeChange={(entry) => {
        choose(entry);
        if (entry === 'selection' && selectionCount(selection) === 0) openPicker();
      }}
      onEditSelection={openPicker}
    />
  );
}

/** Step 3: exactly one start choice – a collection (with its scope) or an empty start; the wizard's primary button applies it. */
export function ContentStep({ workspaceId, saveRef, locale, businessType, applied, onApplied, choice, onChoiceChange, onPrimaryChange }: ContentStepProps) {
  const { t } = useTranslation(['onboarding']);
  const modalContext = useContext(ModalContext);
  const groupName = useId();
  const headingId = useId();
  const catalog = useCatalogTemplates(locale);
  const [applying, setApplying] = useState(false);

  // While the collections load nothing is chosen yet (the wizard waits with its primary button).
  const current = useMemo<StartContentChoice | null>(
    () =>
      catalog.loading
        ? choice
        : effectiveStartContentChoice(
            choice,
            catalog.offered.map((template) => template.key),
            applied.length,
            emptyTemplateSelection,
          ),
    [catalog.loading, catalog.offered, choice, applied.length],
  );
  const action = current ? startContentAction(current, applied.length) : null;
  const template = action?.kind === 'apply' ? catalog.offered.find((entry) => entry.key === action.key) : undefined;
  const again = !!template && !!latestApplied(applied, template.key);
  const label =
    action?.kind === 'empty'
      ? t('onboarding:content.action.empty')
      : action?.kind !== 'apply' || !template
        ? null
        : action.mode === 'selection' && action.count === 0
          ? t('onboarding:content.action.pick')
          : t(`onboarding:content.action.${again ? 'applyAgain' : 'apply'}.${action.mode}`, { template: template.name });

  useEffect(() => {
    onPrimaryChange({ label, loading: catalog.loading });
  }, [catalog.loading, label, onPrimaryChange]);

  useEffect(() => () => onPrimaryChange(null), [onPrimaryChange]);

  useEffect(() => {
    const apply = async (): Promise<boolean> => {
      if (current?.kind !== 'template' || !template) return true;
      if (current.mode === 'selection' && action?.kind === 'apply' && action.count === 0) {
        modalContext.openModal(
          <TemplatePickerDialog
            templateKey={template.key}
            templateName={template.name}
            locale={locale}
            initial={current.selection}
            onConfirm={(picked) => onChoiceChange({ ...current, mode: 'selection', selection: picked })}
          />,
        );
        return false;
      }
      setApplying(true);
      try {
        const result = await applyTemplate(workspaceId, template.key, {
          mode: current.mode,
          ...(current.mode === 'selection' ? { selection: current.selection } : {}),
          ...(businessType ? { businessType } : {}),
        });
        onApplied({ key: template.key, name: template.name, result });
        // Applied: nothing is pending anymore, the button turns into a plain "Next".
        onChoiceChange(null);
        alertService.success(t('onboarding:content.appliedToast', { template: template.name }));
        return true;
      } catch (error) {
        alertApiV1Error(error, t('onboarding:content.applyError'));
        return false;
      } finally {
        setApplying(false);
      }
    };

    saveRef.current = async ({ via, forward, proceed }) => {
      if (catalog.loading) return false;
      if (action?.kind !== 'apply' || !template) return true;
      // Going back keeps the choice (the wizard holds it); jumping ahead must not drop it silently.
      if (via === 'stepper') {
        if (!forward) return true;
        modalContext.openModal(
          <PendingContentDialog
            templateName={template.name}
            onApply={apply}
            onProceed={proceed}
            onSkip={() => {
              onChoiceChange({ kind: 'empty' });
              proceed();
            }}
          />,
        );
        return false;
      }
      return apply();
    };
  }, [saveRef, action, current, template, catalog.loading, workspaceId, locale, businessType, modalContext, onApplied, onChoiceChange, t]);

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <FormSection title={t('onboarding:content.choiceTitle')} description={t('onboarding:content.choiceHelp')}>
        <div role="radiogroup" aria-labelledby={headingId} className="flex flex-col gap-4">
          <span id={headingId} className="sr-only">
            {t('onboarding:content.choiceTitle')}
          </span>
          <CatalogTemplateList catalog={catalog}>
            {(offered) =>
              offered.map((entry) => (
                <ChoiceTemplateTile
                  key={entry.key}
                  locale={locale}
                  template={entry}
                  applied={latestApplied(applied, entry.key)}
                  choice={current}
                  groupName={groupName}
                  busy={applying && current?.kind === 'template' && current.key === entry.key}
                  onChoiceChange={onChoiceChange}
                />
              ))
            }
          </CatalogTemplateList>

          <EmptyOption
            workspaceId={workspaceId}
            groupName={groupName}
            selected={current?.kind === 'empty'}
            disabled={applying}
            somethingApplied={applied.length > 0}
            onSelect={() => onChoiceChange({ kind: 'empty' })}
          />
        </div>
        {catalog.loading ? null : <GuestMenuHints templates={catalog.offered} businessType={businessType} />}
      </FormSection>

      <StartContentHints workspaceId={workspaceId} />
    </div>
  );
}

function EmptyOption({
  workspaceId,
  groupName,
  selected,
  disabled,
  somethingApplied,
  onSelect,
}: {
  workspaceId: string;
  groupName: string;
  selected: boolean;
  disabled: boolean;
  somethingApplied: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation(['onboarding']);
  const titleId = useId();
  const variant = somethingApplied ? 'nothingMore' : 'empty';

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-xl border bg-base-100 p-4 transition-colors',
        selected ? 'border-primary ring-1 ring-primary' : 'border-base-300',
      )}
    >
      <label className="flex cursor-pointer items-start gap-3 has-[:focus-visible]:rounded-md has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary">
        <Radio name={groupName} className="mt-1" checked={selected} disabled={disabled} aria-labelledby={titleId} onChange={onSelect} />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span id={titleId} className="text-lg leading-snug font-semibold">
            {t(`onboarding:content.${variant}.title`)}
          </span>
          <span className="text-sm text-base-content/70">{t(`onboarding:content.${variant}.help`)}</span>
        </span>
      </label>
      {somethingApplied ? null : (
        <Link href={settingsHref(workspaceId, 'data')} className="link pl-8 text-sm">
          {t('onboarding:content.importBackup')}
        </Link>
      )}
    </div>
  );
}

/** Collections that bring a guest menu (`counts.guestMenus` is optional: older servers do not report it). */
function GuestMenuHints({ templates, businessType }: { templates: TemplateSummaryDto[]; businessType: BusinessType | null }) {
  const { t } = useTranslation(['onboarding']);
  const withGuestMenu = templates.filter((template) => (template.counts.guestMenus ?? 0) > 0);
  if (withGuestMenu.length === 0) return null;
  return (
    <>
      {withGuestMenu.map((template) => (
        <SetupHint key={template.key}>
          {t('onboarding:content.guestMenu.included', { template: template.name, count: template.counts.guestMenus })}{' '}
          {businessType
            ? t('onboarding:content.guestMenu.design', { type: t(`onboarding:basics.types.${businessType}.title`) })
            : t('onboarding:content.guestMenu.designDefault')}
        </SetupHint>
      ))}
    </>
  );
}
